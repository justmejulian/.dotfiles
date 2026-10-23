"""Isolated bridge tests: fake Herdr/GitHub, temporary queue state, no services."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class FeedbackBridgeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="feedback-bridge-test-")
        self.root = Path(self.temporary.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.trace = self.root / "calls.jsonl"
        self.status = self.root / "status"
        self.status.write_text("idle")
        self.herdr = self.bin / "herdr"
        self.herdr.write_text('''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
args=sys.argv[1:]
with open(os.environ['TEST_TRACE'],'a') as f:f.write(json.dumps(args)+'\\n')
if args[:2]==['pane','get']:
 print(json.dumps({'result':{'pane':{'workspace_id':'ws'}}}))
elif args[:2]==['tab','list']:
 print(json.dumps({'result':{'tabs':[{'tab_id':'main','label':'ai'},{'tab_id':'other','label':'worker'}]}}))
elif args[:2]==['pane','list']:
 count=int(os.environ.get('TEST_AI_COUNT','1'))
 panes=[{'pane_id':'worker','tab_id':'other','agent':'pi'}]+[{'pane_id':'ai-'+str(i),'tab_id':'main','agent':'pi'} for i in range(count)]
 print(json.dumps({'result':{'panes':panes}}))
elif args[:2]==['agent','get']:
 status=Path(os.environ['TEST_STATUS']).read_text()
 if os.environ.get('TEST_IDLE_THEN_BUSY'):
  Path(os.environ['TEST_STATUS']).write_text('working')
 print(json.dumps({'result':{'agent':{'agent_status':status}}}))
elif args[:2]==['agent','prompt']:
 outcome=os.environ.get('TEST_DELIVERY','ok')
 if outcome!='ok':
  print(json.dumps({'error':{'code':'agent_blocked' if outcome=='blocked' else 'connection_lost'}}))
  sys.exit(1)
else:sys.exit(99)
''')
        self.herdr.chmod(0o755)
        for name in ["gh", "pi-workflows"]:
            file = self.bin / name
            file.write_text("#!/bin/sh\necho 'unexpected service call' >&2\nexit 98\n")
            file.chmod(0o755)
        self.env = {
            **os.environ,
            "PATH": str(self.bin) + ":" + os.environ["PATH"],
            "HERDR_BIN_PATH": str(self.herdr),
            "PR_REVIEW_STATE": str(self.root / "state"),
            "PLUGIN_LIB": str(Path(__file__).with_name("lib.sh")),
            "TEST_TRACE": str(self.trace),
            "TEST_STATUS": str(self.status),
        }
        self.queue = self.root / "state/org_repo_42/pending.jsonl"

    def tearDown(self):
        self.temporary.cleanup()

    def run_shell(self, command, check=True):
        result = subprocess.run(
            ["bash", "-c", 'source "$PLUGIN_LIB"; ' + command],
            env=self.env, capture_output=True, text=True, timeout=10,
        )
        if check:
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        return result

    def enqueue(self):
        self.env["ITEMS"] = json.dumps({"kind": "ci", "key": "ci:head:test", "body": "failed"})
        self.run_shell('queue_items org/repo 42 "$ITEMS"')

    def deliver(self):
        return self.run_shell("launch_pending org/repo 42 worker")

    def calls(self):
        return [json.loads(line) for line in self.trace.read_text().splitlines()] if self.trace.exists() else []

    def prompts(self):
        return [call for call in self.calls() if call[:2] == ["agent", "prompt"]]

    def test_success_targets_ai_tab_ignores_legacy_marker_and_records_submission(self):
        self.enqueue()
        self.run_shell('queue_items org/repo 42 "$ITEMS"')
        self.assertEqual(len(self.queue.read_text().splitlines()), 1)
        marker = self.root / "state/active/org_repo_42"
        marker.parent.mkdir()
        marker.write_text("legacy-run")
        self.deliver()
        self.assertEqual(len(self.prompts()), 1)
        prompt = self.prompts()[0]
        self.assertEqual(prompt[2], "ai-0")
        self.assertNotIn("/workflow", prompt[3])
        self.assertIn("grants no new authority", prompt[3])
        self.assertEqual(self.queue.read_text(), "")
        receipts = list(self.queue.parent.glob("*.submitted.json"))
        self.assertEqual(len(receipts), 1)
        self.assertEqual(json.loads(receipts[0].read_text())["state"], "submitted")
        self.assertEqual(marker.read_text(), "legacy-run")
        self.assertFalse((self.queue.parent / "pending.lock").exists())

    def test_busy_or_missing_or_ambiguous_ai_target_retains_queue(self):
        self.enqueue()
        self.status.write_text("working")
        self.deliver()
        self.status.write_text("idle")
        for count in ["0", "2"]:
            self.env["TEST_AI_COUNT"] = count
            self.deliver()
        self.assertEqual(self.prompts(), [])
        self.assertTrue(self.queue.read_text())

    def test_idle_to_busy_transition_does_not_submit(self):
        self.enqueue()
        self.env["TEST_IDLE_THEN_BUSY"] = "1"
        self.deliver()
        self.assertEqual(self.prompts(), [])
        self.assertTrue(self.queue.read_text())

    def test_definite_blocked_rejection_can_retry_same_immutable_batch(self):
        self.enqueue()
        self.env["TEST_DELIVERY"] = "blocked"
        self.deliver()
        self.assertTrue(self.queue.read_text())
        self.assertFalse((self.queue.parent / "delivery-inflight.json").exists())
        first = self.prompts()[0][3]
        self.env["TEST_DELIVERY"] = "ok"
        self.deliver()
        self.assertEqual(self.prompts()[1][3], first)
        self.assertEqual(self.queue.read_text(), "")

    def test_uncertain_submission_is_preserved_and_not_automatically_retried(self):
        self.enqueue()
        self.env["TEST_DELIVERY"] = "unknown"
        self.deliver()
        self.env["TEST_DELIVERY"] = "ok"
        result = self.deliver()
        self.assertIn("needs reconciliation", result.stdout)
        self.assertEqual(len(self.prompts()), 1)
        self.assertTrue(self.queue.read_text())
        self.assertTrue((self.queue.parent / "delivery-inflight.json").exists())

    def test_malformed_pending_data_never_submits_or_clears_queue(self):
        self.enqueue()
        self.queue.write_text("not JSON\n")
        result = self.run_shell("launch_pending org/repo 42 worker", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.prompts(), [])
        self.assertEqual(self.queue.read_text(), "not JSON\n")
        self.assertFalse((self.queue.parent / "pending.lock").exists())

    def test_concurrent_watchers_submit_nonempty_batch_once(self):
        self.enqueue()
        command = ["bash", "-c", 'source "$PLUGIN_LIB"; launch_pending org/repo 42 worker']
        processes = [subprocess.Popen(command, env=self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
        for process in processes:
            stdout, stderr = process.communicate(timeout=10)
            self.assertEqual(process.returncode, 0, stdout + stderr)
        self.assertEqual(len(self.prompts()), 1)
        self.assertEqual(self.queue.read_text(), "")
        self.assertFalse((self.queue.parent / "pending.lock").exists())


if __name__ == "__main__":
    unittest.main()
