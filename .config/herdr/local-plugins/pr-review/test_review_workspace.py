"""Offline topology/restore tests: fake CLI only; no live Herdr or GitHub."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest


PLUGIN = Path(__file__).parent
SETUP = PLUGIN.parent / "workspace-setup/setup.sh"
FAKE = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
with open(os.environ['TEST_TRACE'], 'a') as f:
    f.write(json.dumps([Path(sys.argv[0]).name] + args) + '\n')
if Path(sys.argv[0]).name == 'gh':
    assert args[:2] == ['pr', 'view'], args
    print(os.environ.get('TEST_PR_URL', 'https://github.com/org/repo/pull/42'))
    sys.exit(0)
path = Path(os.environ['TEST_TOPOLOGY'])
s = json.loads(path.read_text())
def save():
    path.write_text(json.dumps(s))
def result(key, value):
    print(json.dumps({'result': {key: value}}))
def option(name):
    return args[args.index(name) + 1]
kind, action = args[:2]
if action == 'get' and kind in ['workspace', 'tab', 'pane']:
    value = s[kind + 's'].get(args[2])
    if value is None: sys.exit(1)
    result(kind, value)
elif action == 'list' and kind in ['tab', 'pane']:
    result(kind + 's', [v for v in s[kind + 's'].values() if v['workspace_id'] == option('--workspace')])
elif args[:2] == ['workspace', 'create']:
    s['next'] += 1
    ws = 'review-' + str(s['next'])
    tab, pane = ws + ':t1', ws + ':p1'
    s['workspaces'][ws] = {'workspace_id': ws, 'label': option('--label'), 'cwd': option('--cwd')}
    s['tabs'][tab] = {'workspace_id': ws, 'tab_id': tab, 'label': 'shell'}
    s['panes'][pane] = {'workspace_id': ws, 'tab_id': tab, 'pane_id': pane, 'cwd': option('--cwd')}
    save()
    print(json.dumps({'result': {'workspace': s['workspaces'][ws], 'tab': s['tabs'][tab], 'root_pane': s['panes'][pane]}}))
elif args[:2] == ['tab', 'rename']:
    s['tabs'][args[2]]['label'] = args[3]
    save()
elif args[:2] == ['pane', 'split']:
    original = s['panes'][args[2]]
    ws = original['workspace_id']
    pane = ws + ':p' + str(1 + sum(v['workspace_id'] == ws for v in s['panes'].values()))
    s['panes'][pane] = {**original, 'pane_id': pane, 'cwd': option('--cwd')}
    save()
    result('pane', s['panes'][pane])
elif args[:2] == ['tab', 'create']:
    result('root_pane', {'pane_id': 'unused'})
elif args[:2] == ['agent', 'get']:
    result('agent', {'agent_status': 'idle'})
elif args[:2] in [['pane', 'run'], ['notification', 'show'], ['agent', 'prompt']]:
    pass
else:
    print('unexpected call: ' + repr(args), file=sys.stderr)
    sys.exit(99)
'''


def development(ws, cwd):
    return {
        "workspace": {"workspace_id": ws, "label": "development"},
        "tab": {"workspace_id": ws, "tab_id": ws + ":t1", "label": "ai"},
        "pane": {"workspace_id": ws, "tab_id": ws + ":t1", "pane_id": ws + ":p1", "agent": "pi", "cwd": str(cwd)},
    }


class ReviewWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="review-workspace-test-")
        self.root = Path(self.temporary.name)
        self.checkout = self.root / "source checkout"
        self.checkout.mkdir()
        self.bin = self.root / "bin"
        self.bin.mkdir()
        for name in ["herdr", "gh"]:
            command = self.bin / name
            command.write_text(FAKE)
            command.chmod(0o755)
        self.trace = self.root / "trace.jsonl"
        self.topology = self.root / "topology.json"
        self.state = self.root / "state"
        self.env = {
            **os.environ,
            "PATH": str(self.bin) + ":" + os.environ["PATH"],
            "HERDR_BIN_PATH": str(self.bin / "herdr"),
            "PR_REVIEW_STATE": str(self.state),
            "TEST_TRACE": str(self.trace),
            "TEST_TOPOLOGY": str(self.topology),
        }
        s = {"next": 0, "workspaces": {}, "tabs": {}, "panes": {}}
        for ws in ["dev", "other"]:
            for kind, value in development(ws, self.checkout).items():
                s[kind + "s"][value[kind + "_id"]] = value
        self.save(s)

    def tearDown(self):
        self.temporary.cleanup()

    def save(self, s):
        self.topology.write_text(json.dumps(s))

    def topology_data(self):
        return json.loads(self.topology.read_text())

    def run_script(self, name, *args, code=0):
        script = SETUP if name == "setup.sh" else PLUGIN / name
        result = subprocess.run(["bash", str(script), *args], env=self.env,
                                capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, code, result.stdout + result.stderr)
        return result

    def open(self, pane="dev:p1"):
        return self.run_script("open.sh", str(self.checkout), "", pane)

    def calls(self, *prefix):
        calls = [json.loads(line) for line in self.trace.read_text().splitlines()] if self.trace.exists() else []
        return [c[len(prefix):] for c in calls if c[:len(prefix)] == list(prefix)]

    def record_file(self):
        record, = (self.state / "workspaces").glob("*.json")
        return record

    def test_creates_labeled_background_workspace_with_source_cwd_and_anchor(self):
        self.open()
        create, = self.calls("herdr", "workspace", "create")
        self.assertEqual(create, ["--cwd", str(self.checkout), "--label", "review - repo#42", "--no-focus"])
        self.assertEqual(self.calls("herdr", "tab", "create"), [])
        self.assertEqual(len(self.calls("herdr", "pane", "split")), 2)
        for split in self.calls("herdr", "pane", "split"):
            self.assertIn("--no-focus", split)
            self.assertEqual(split[split.index("--cwd") + 1], str(self.checkout))
        record = json.loads(self.record_file().read_text())
        self.assertEqual((record["source_workspace"], record["source_pane"], record["cwd"]), ("dev", "dev:p1", str(self.checkout)))
        for command in record["commands"][1:]:
            self.assertEqual(shlex.split(command["command"])[1:], ["org/repo", "42", "dev:p1"])
        self.assertEqual(len(self.calls("herdr", "pane", "run")), 3)
        self.assertEqual(self.calls("herdr", "agent", "prompt"), [])

    def test_same_identity_reuses_without_restarting_any_panes(self):
        self.open()
        original = self.record_file().read_text()
        result = self.open()
        self.assertIn("already open", result.stdout)
        self.assertEqual(self.record_file().read_text(), original)
        self.assertEqual(len(self.calls("herdr", "workspace", "create")), 1)
        self.assertEqual(len(self.calls("herdr", "pane", "run")), 3)

    def test_distinct_pr_repository_and_source_workspace_have_separate_records(self):
        self.open()
        self.env["TEST_PR_URL"] = "https://github.com/org/repo/pull/43"
        self.open()
        self.env["TEST_PR_URL"] = "https://github.com/another/repo/pull/43"
        self.open()
        self.open("other:p1")
        self.assertEqual(len(self.calls("herdr", "workspace", "create")), 4)
        self.assertEqual(len(list((self.state / "workspaces").glob("*.json"))), 4)

    def test_stale_workspace_tab_or_pane_record_does_not_reuse_or_touch_old_panes(self):
        for kind, field in [("workspaces", "workspace"), ("tabs", "tab"), ("panes", "pane")]:
            with self.subTest(kind=kind):
                self.open()
                record = json.loads(self.record_file().read_text())
                s = self.topology_data()
                identifier = record["commands"][0]["pane"] if field == "pane" else record[field]
                del s[kind][identifier]
                self.save(s)
                before = len(self.calls("herdr", "pane", "run"))
                self.open()
                fresh = json.loads(self.record_file().read_text())
                self.assertNotEqual(fresh["workspace"], record["workspace"])
                self.assertEqual(len(self.calls("herdr", "pane", "run")), before + 3)
        self.assertEqual(self.calls("herdr", "workspace", "close"), [])

    def test_matching_label_without_identity_and_legacy_tab_are_not_adopted(self):
        s = self.topology_data()
        s["workspaces"]["other"]["label"] = "review - repo#42"
        s["tabs"]["dev:legacy"] = {"workspace_id": "dev", "tab_id": "dev:legacy", "label": "PR review"}
        self.save(s)
        self.open()
        self.assertEqual(len(self.calls("herdr", "workspace", "create")), 1)
        self.assertEqual(self.topology_data()["tabs"]["dev:legacy"], s["tabs"]["dev:legacy"])

    def test_wrong_live_membership_or_label_is_stale(self):
        self.open()
        record = json.loads(self.record_file().read_text())
        s = self.topology_data()
        s["panes"][record["commands"][0]["pane"]]["tab_id"] = "other:t1"
        self.save(s)
        self.open()
        record = json.loads(self.record_file().read_text())
        s = self.topology_data()
        s["workspaces"][record["workspace"]]["label"] = "repurposed"
        self.save(s)
        self.open()
        self.assertEqual(len(self.calls("herdr", "workspace", "create")), 3)

    def test_malformed_record_is_replaced_without_running_its_commands(self):
        self.open()
        self.record_file().write_text("not json")
        self.open()
        self.assertEqual(len(self.calls("herdr", "workspace", "create")), 2)

    def test_restore_replays_exact_commands_with_original_anchor(self):
        self.open()
        initial = self.calls("herdr", "pane", "run")
        self.trace.unlink()
        self.run_script("restore.sh")
        self.assertEqual(self.calls("herdr", "pane", "run"), initial)
        self.assertEqual(self.calls("herdr", "workspace", "create"), [])

    def test_restore_forgets_stale_record_without_running_partial_topology(self):
        self.open()
        record_file = self.record_file()
        record = json.loads(record_file.read_text())
        s = self.topology_data()
        del s["panes"][record["commands"][2]["pane"]]
        self.save(s)
        self.trace.unlink()
        self.run_script("restore.sh")
        self.assertFalse(record_file.exists())
        self.assertEqual(self.calls("herdr", "pane", "run"), [])

    def test_legacy_restore_converts_tuicr_and_skips_moved_panes(self):
        s = self.topology_data()
        s["tabs"]["dev:t1"]["label"] = "PR review"
        self.save(s)
        tabs = self.state / "tabs"
        tabs.mkdir(parents=True)
        legacy = tabs / "dev:t1"
        legacy.write_text("dev:p1\ttuicr pr https://github.com/org/repo/pull/42\nother:p1\techo wrong tab\n")
        (tabs / "closed").write_text("missing\techo closed\n")
        self.run_script("restore.sh")
        run, = self.calls("herdr", "pane", "run")
        self.assertEqual(run[0], "dev:p1")
        self.assertEqual(shlex.split(run[1]), ["nvim", "-c", "Atlas review https://github.com/org/repo/pull/42"])
        self.assertTrue(legacy.exists())
        self.assertFalse((tabs / "closed").exists())

    def test_setup_excludes_review_prefix_before_any_layout_or_run(self):
        self.open()
        self.trace.unlink()
        self.env["HERDR_WORKSPACE_ID"] = "review-1"
        self.run_script("setup.sh")
        self.assertEqual(self.calls("herdr"), [["workspace", "get", "review-1"]])

    def test_setup_normal_workspace_still_starts_pi_and_shell(self):
        self.env["HERDR_WORKSPACE_ID"] = "dev"
        self.run_script("setup.sh")
        self.assertEqual(self.calls("herdr", "tab", "rename"), [["dev:t1", "ai"]])
        self.assertEqual(self.calls("herdr", "pane", "run"), [["dev:p1", "pi --orchestrator"]])
        self.assertEqual(len(self.calls("herdr", "tab", "create")), 1)

    def test_action_resolves_original_development_ai_pane(self):
        self.env["HERDR_PLUGIN_CONTEXT_JSON"] = json.dumps({"workspace_id": "dev"})
        self.run_script("action.sh")
        record = json.loads(self.record_file().read_text())
        self.assertEqual(record["source_pane"], "dev:p1")

    def test_feedback_from_review_workspace_targets_source_ai_only(self):
        self.open()
        record = json.loads(self.record_file().read_text())
        anchor = shlex.split(record["commands"][1]["command"])[3]
        self.trace.unlink()
        command = 'source "$1"; queue_items org/repo 42 \'{"key":"test","kind":"ci"}\'; launch_pending org/repo 42 "$2"'
        result = subprocess.run(["bash", "-c", command, "test", str(PLUGIN / "lib.sh"), anchor], env=self.env,
                                capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        prompt, = self.calls("herdr", "agent", "prompt")
        self.assertEqual(prompt[0], "dev:p1")
        self.assertEqual(self.calls("herdr", "tab", "list"), [["--workspace", "dev"]])
        self.assertEqual(self.calls("herdr", "pane", "list"), [["--workspace", "dev"]])

    def test_invalid_pr_url_never_creates_workspace(self):
        self.env["TEST_PR_URL"] = "https://example.test/not-a-pr"
        self.run_script("open.sh", str(self.checkout), "", "dev:p1", code=1)
        self.assertEqual(self.calls("herdr", "workspace", "create"), [])


if __name__ == "__main__":
    unittest.main()
