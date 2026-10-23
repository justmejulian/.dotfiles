"""One-shot watcher tests: local command fakes only, no services or real sleeps."""
import json
import os
from pathlib import Path
import select
import subprocess
import tempfile
import unittest


SHA = "a" * 40
NEW_SHA = "b" * 40
SCRIPT = Path(__file__).with_name("ci-watch.sh")
FAKE = r'''#!/usr/bin/env python3
import json, os, signal, sys
from pathlib import Path
root = Path(os.environ['CI_TEST_ROOT'])
config = json.loads((root / 'config.json').read_text())
command = Path(sys.argv[0]).name
args = sys.argv[1:]
with (root / 'trace.jsonl').open('a') as trace:
    trace.write(json.dumps([command] + args) + '\n')
counters_path = root / 'counters.json'
counters = json.loads(counters_path.read_text()) if counters_path.exists() else {}
def next_value(key, default):
    values = config.get(key, [default])
    index = counters.get(key, 0)
    counters[key] = index + 1
    counters_path.write_text(json.dumps(counters))
    return values[min(index, len(values) - 1)]
if command == 'gh':
    if args[:2] == ['pr', 'view']:
        value = next_value('heads', 'a' * 40)
        if value is None:
            print('head API error', file=sys.stderr)
            sys.exit(1)
        print(value)
    elif args[:2] == ['pr', 'checks'] and '--watch' in args:
        if config.get('block_watch'):
            print('native watch ready', flush=True)
            sys.stdin.read(1)
        if config.get('signal_watch'):
            os.kill(os.getppid(), signal.SIGTERM)
        print('native gh progress')
        sys.exit(next_value('watch_codes', 0))
    elif args[:2] == ['pr', 'checks'] and '--json' in args:
        value = next_value('summaries', [])
        print(value if isinstance(value, str) else json.dumps(value))
        sys.exit(next_value('summary_codes', 0))
    else:
        sys.exit(99)
elif command == 'sleep':
    if config.get('idle_after_sleep'):
        (root / 'status').write_text('idle')
elif command == 'herdr':
    if args[:2] == ['notification', 'show']:
        sys.exit(config.get('notice_code', 0))
    elif args[:2] == ['pane', 'get']:
        if config.get('missing_pane'):
            sys.exit(1)
        print(json.dumps({'result': {'pane': {'workspace_id': 'workspace'}}}))
    elif args[:2] == ['tab', 'list']:
        print(json.dumps({'result': {'tabs': [{'tab_id': 'main', 'label': 'ai'}]}}))
    elif args[:2] == ['pane', 'list']:
        print(json.dumps({'result': {'panes': [
            {'pane_id': 'ai-' + str(i), 'tab_id': 'main', 'agent': 'pi'}
            for i in range(config.get('ai_count', 1))]}}))
    elif args[:2] == ['agent', 'get']:
        print(json.dumps({'result': {'agent': {'agent_status': (root / 'status').read_text()}}}))
    elif args[:2] == ['agent', 'prompt']:
        delivery = config.get('delivery', 'ok')
        if delivery != 'ok':
            print(json.dumps({'error': {'code': 'agent_blocked' if delivery == 'blocked' else 'connection_lost'}}))
            sys.exit(1)
    else:
        sys.exit(99)
else:
    sys.exit(99)
'''


def check(name="test", bucket="pass", state="SUCCESS", completed="2026-10-23T10:00:00Z", link=None):
    return {
        "name": name, "bucket": bucket, "state": state,
        "link": link if link is not None else "https://example.test/" + name,
        "startedAt": "2026-10-23T09:00:00Z", "completedAt": completed,
        "workflow": "CI", "event": "pull_request",
    }


class CiWatchTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="ci-watch-test-")
        self.root = Path(self.temporary.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        for command in ["gh", "herdr", "sleep"]:
            executable = self.bin / command
            executable.write_text(FAKE)
            executable.chmod(0o755)
        self.config = {"summaries": [[check()]]}
        self.status = self.root / "status"
        self.status.write_text("idle")
        self.env = {
            **os.environ, "PATH": str(self.bin) + ":" + os.environ["PATH"],
            "HERDR_BIN_PATH": str(self.bin / "herdr"),
            "PR_REVIEW_STATE": str(self.root / "state"),
            "CI_TEST_ROOT": str(self.root),
        }
        self.state = self.root / "state/org_repo_42"

    def tearDown(self):
        self.temporary.cleanup()

    def command(self):
        return ["/bin/bash", str(SCRIPT), "org/repo", "42", "worker"]

    def save_config(self):
        (self.root / "config.json").write_text(json.dumps(self.config))

    def run_watcher(self, code=0):
        self.save_config()
        result = subprocess.run(self.command(), env=self.env, text=True, capture_output=True, timeout=15)
        self.assertEqual(result.returncode, code, result.stdout + result.stderr)
        self.assertFalse((self.state / "ci-watch.lock").exists())
        return result

    def calls(self, command=None, prefix=None):
        trace = self.root / "trace.jsonl"
        calls = [json.loads(line) for line in trace.read_text().splitlines()] if trace.exists() else []
        return [call for call in calls if (command is None or call[0] == command)
                and (prefix is None or call[1:1 + len(prefix)] == prefix)]

    def items(self):
        batches = list(self.state.glob("batch-*.json"))
        return [item for batch in batches for item in json.loads(batch.read_text()).get("items", [])]

    def assert_no_completion(self):
        self.assertEqual(self.items(), [])
        self.assertEqual(self.calls("herdr", ["notification", "show"]), [])
        self.assertEqual(list(self.state.glob("ci-results/*.queued")), [])

    def test_success_native_flags_and_permission_safe_shared_transport(self):
        result = self.run_watcher()
        self.assertIn("native gh progress", result.stdout)
        watches = [call for call in self.calls("gh") if "--watch" in call]
        self.assertEqual(watches, [["gh", "pr", "checks", "42", "--repo", "org/repo", "--watch", "--interval", "30"]])
        item, = self.items()
        self.assertEqual((item["repo"], item["pr"], item["sha"], item["outcome"]), ("org/repo", 42, SHA, "pass"))
        self.assertEqual(item["counts"], {"total": 1, "passed": 1, "failed": 0, "skipped": 0})
        prompt, = self.calls("herdr", ["agent", "prompt"])
        self.assertEqual(prompt[3], "ai-0")
        self.assertIn("grants no new authority", prompt[4])
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 1)

    def test_failed_multi_check_summary_includes_non_actions_and_skips(self):
        external = check("external", "fail", "ERROR", link="https://external.test/result")
        external.update(workflow=None, startedAt=None, completedAt=None)
        self.config.update(watch_codes=[1], summary_codes=[1], summaries=[[
            check(), check("lint", "fail", "FAILURE"), external,
            check("optional", "skipping", "SKIPPED"),
        ]])
        self.run_watcher()
        item, = self.items()
        self.assertEqual(item["outcome"], "fail")
        self.assertEqual(item["counts"], {"total": 4, "passed": 1, "failed": 2, "skipped": 1})
        self.assertEqual({job["name"] for job in item["failed"]}, {"lint", "external"})
        self.assertIn("https://external.test/result", {job["url"] for job in item["failed"]})
        self.assertTrue(all("--fail-fast" not in call and "--required" not in call for call in self.calls("gh")))

    def test_invalid_or_unsettled_summaries_never_complete(self):
        cases = [
            ([], 0, "no checks"),
            ([check(bucket="pending", state="IN_PROGRESS")], 8, "pending"),
            ([check(), check("waiting", "pending", "QUEUED")], 8, "pending"),
            ([check(bucket="cancel", state="CANCELLED")], 1, "cancelled"),
            ("not JSON", 0, "malformed"),
            ("[]\n[]", 0, "malformed"),
            ({"error": "API"}, 0, "malformed"),
            ([{"name": "bad"}], 0, "malformed"),
            ([check(bucket="pass", state="IN_PROGRESS")], 0, "inconsistent"),
        ]
        for summary, code, message in cases:
            with self.subTest(summary=summary):
                self.config.update(summaries=[summary], summary_codes=[code])
                result = self.run_watcher(code=1)
                self.assertIn(message, result.stderr)
                self.assert_no_completion()

    def test_watch_and_summary_errors_cannot_be_mistaken_for_ci_failure(self):
        cases = [
            ({"watch_codes": [2]}, "watch error"),
            ({"watch_codes": [1]}, "disagrees"),
            ({"summary_codes": [2]}, "API error"),
            ({"summary_codes": [1]}, "disagrees"),
            ({"heads": [None]}, "cannot read PR head"),
            ({"heads": ["bad-sha"]}, "cannot read PR head"),
            ({"heads": [SHA, None]}, "cannot validate PR head"),
        ]
        for config, message in cases:
            with self.subTest(config=config):
                self.config = {"summaries": [[check()]], **config}
                (self.root / "counters.json").unlink(missing_ok=True)
                result = self.run_watcher(code=1)
                self.assertIn(message, result.stderr)
                self.assert_no_completion()

    def test_native_cancellation_and_signal_cleanup(self):
        self.config["watch_codes"] = [130]
        self.assertIn("cancelled", self.run_watcher(code=130).stderr)
        self.assert_no_completion()
        self.config = {"signal_watch": True}
        self.assertIn("cancelled (TERM)", self.run_watcher(code=143).stderr)
        self.assert_no_completion()

    def test_head_changes_during_watch_summary_or_before_enqueue_restart(self):
        for position in [1, 2, 3]:
            with self.subTest(position=position), tempfile.TemporaryDirectory() as isolated:
                self.env["PR_REVIEW_STATE"] = isolated
                self.state = Path(isolated) / "org_repo_42"
                (self.root / "counters.json").unlink(missing_ok=True)
                (self.root / "trace.jsonl").unlink(missing_ok=True)
                self.config["heads"] = [SHA] * position + [NEW_SHA] * 8
                result = self.run_watcher()
                self.assertIn("discarding old result", result.stdout)
                item, = self.items()
                self.assertEqual(item["sha"], NEW_SHA)
                self.assertEqual(len([call for call in self.calls("gh") if "--watch" in call]), 2)

    def test_head_churn_is_bounded(self):
        self.config["heads"] = [SHA, NEW_SHA] * 5
        self.assertIn("kept changing", self.run_watcher(code=1).stderr)
        self.assert_no_completion()
        self.assertEqual(len([call for call in self.calls("gh") if "--watch" in call]), 5)

    def test_duplicate_result_and_same_sha_rerun_identity(self):
        self.run_watcher()
        self.run_watcher()
        self.assertEqual(len(self.items()), 1)
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 1)
        self.config["summaries"] = [[check(completed="2026-10-23T11:00:00Z")]]
        self.run_watcher()
        self.assertEqual(len(self.items()), 2)
        self.assertEqual(len({item["key"] for item in self.items()}), 2)
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 2)

    def test_interrupted_result_ledger_recovers_from_pending_or_immutable_batch(self):
        self.status.write_text("working")
        self.run_watcher()
        for marker in self.state.glob("ci-results/*.queued"):
            marker.unlink()
        self.run_watcher()
        self.assertEqual(len((self.state / "pending.jsonl").read_text().splitlines()), 1)
        self.status.write_text("idle")
        self.run_watcher()
        for marker in self.state.glob("ci-results/*.queued"):
            marker.unlink()
        self.run_watcher()
        self.assertEqual(len(self.calls("herdr", ["agent", "prompt"])), 1)
        self.assertEqual(len(self.items()), 1)
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 1)

    def test_same_sha_rerun_with_new_link_and_no_timestamps_is_new_result(self):
        external = check("external", completed=None)
        external.update(startedAt=None, workflow=None)
        self.config["summaries"] = [[external]]
        self.run_watcher()
        external["link"] = "https://external.test/rerun"
        self.config["summaries"] = [[external]]
        self.run_watcher()
        self.assertEqual(len(self.items()), 2)

    def test_check_order_is_not_a_new_result(self):
        first, second = check("one"), check("two")
        self.config["summaries"] = [[first, second]]
        self.run_watcher()
        self.config["summaries"] = [[second, first]]
        self.run_watcher()
        self.assertEqual(len(self.items()), 1)

    def test_duplicate_concurrent_watcher_does_not_watch_or_steal_lock(self):
        self.config["block_watch"] = True
        self.save_config()
        process = subprocess.Popen(self.command(), env=self.env, text=True, stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            self.assertTrue(select.select([process.stdout], [], [], 10)[0])
            self.assertEqual(process.stdout.readline().strip(), "native watch ready")
            duplicate = subprocess.run(self.command(), env=self.env, capture_output=True, text=True, timeout=10)
            self.assertEqual(duplicate.returncode, 1)
            self.assertIn("not stealing", duplicate.stderr)
            self.assertTrue((self.state / "ci-watch.lock").exists())
            stdout, stderr = process.communicate("x", timeout=15)
            self.assertEqual(process.returncode, 0, stdout + stderr)
            self.assertEqual(len([call for call in self.calls("gh") if "--watch" in call]), 1)
        finally:
            if process.poll() is None:
                process.communicate("x", timeout=15)
        self.assertFalse((self.state / "ci-watch.lock").exists())

    def test_stale_lock_is_never_stolen(self):
        lock = self.state / "ci-watch.lock"
        lock.mkdir(parents=True)
        (lock / "pid").write_text("99999999")
        self.save_config()
        result = subprocess.run(self.command(), env=self.env, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertEqual((lock / "pid").read_text(), "99999999")
        self.assertEqual(self.calls(), [])

    def test_blocked_submission_retries_are_bounded(self):
        self.config["delivery"] = "blocked"
        self.run_watcher()
        self.assertTrue((self.state / "pending.jsonl").read_text())
        self.assertFalse((self.state / "delivery-inflight.json").exists())
        self.assertEqual(len(self.calls("herdr", ["agent", "prompt"])), 11)
        self.assertEqual(len(self.calls("sleep")), 10)
        self.assertEqual(len(self.calls("gh")), 6)

    def test_busy_target_bounded_retry_and_retained_queue(self):
        self.status.write_text("working")
        self.run_watcher()
        self.assertTrue((self.state / "pending.jsonl").read_text())
        self.assertEqual(self.calls("herdr", ["agent", "prompt"]), [])
        self.assertEqual(self.calls("sleep"), [["sleep", "30"]] * 10)
        self.assertEqual(len(self.calls("gh")), 6)

    def test_busy_then_idle_submits_without_more_github_polling(self):
        self.status.write_text("working")
        self.config["idle_after_sleep"] = True
        self.run_watcher()
        self.assertEqual(len(self.calls("sleep")), 1)
        self.assertEqual(len(self.calls("herdr", ["agent", "prompt"])), 1)
        self.assertEqual((self.state / "pending.jsonl").read_text(), "")
        self.assertEqual(len(self.calls("gh")), 6)

    def test_missing_and_ambiguous_targets_hold_without_retrying(self):
        for config in [{"ai_count": 0}, {"ai_count": 2}, {"missing_pane": True}]:
            with self.subTest(config=config):
                self.config.update(config)
                self.run_watcher()
                self.assertTrue((self.state / "pending.jsonl").read_text())
                self.assertEqual(self.calls("herdr", ["agent", "prompt"]), [])
                self.assertEqual(self.calls("sleep"), [])

    def test_uncertain_delivery_is_held_across_watcher_restarts(self):
        self.config["delivery"] = "unknown"
        self.run_watcher()
        self.config["delivery"] = "ok"
        self.run_watcher()
        self.assertEqual(len(self.calls("herdr", ["agent", "prompt"])), 1)
        self.assertTrue((self.state / "delivery-inflight.json").exists())
        self.assertTrue((self.state / "pending.jsonl").read_text())
        self.assertEqual(self.calls("sleep"), [])

    def test_old_feedback_flushes_even_when_current_watch_cannot_complete(self):
        self.state.mkdir(parents=True)
        (self.state / "pending.jsonl").write_text(json.dumps({"key": "old", "kind": "comment"}) + "\n")
        self.config["summaries"] = [[]]
        self.run_watcher(code=1)
        self.assertEqual(len(self.calls("herdr", ["agent", "prompt"])), 1)
        self.assertEqual(self.items()[0]["key"], "old")
        self.assertEqual(self.calls("herdr", ["notification", "show"]), [])

    def test_old_feedback_flushes_even_after_api_error(self):
        self.state.mkdir(parents=True)
        (self.state / "pending.jsonl").write_text(json.dumps({"key": "old", "kind": "comment"}) + "\n")
        self.config["watch_codes"] = [2]
        self.run_watcher(code=1)
        self.assertEqual(len(self.calls("herdr", ["agent", "prompt"])), 1)
        self.assertEqual(self.items()[0]["key"], "old")
        self.assertEqual(self.calls("herdr", ["notification", "show"]), [])

    def test_failed_notification_is_not_blindly_repeated(self):
        self.config["notice_code"] = 1
        self.assertIn("notification attempt failed", self.run_watcher().stderr)
        self.run_watcher()
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 1)


if __name__ == "__main__":
    unittest.main()
