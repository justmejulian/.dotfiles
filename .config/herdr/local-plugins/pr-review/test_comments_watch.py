"""One-shot comment watcher tests. Temporary state and fake gh/herdr only."""
import json
from pathlib import Path
import subprocess
import unittest

import test_ci_watch as ci


SCRIPT = Path(__file__).with_name("comments-watch.sh")
COMMENT_GH = '''if command == 'gh':
    if args[:2] == ['pr', 'view']:
        if config.get('signal_state'):
            os.kill(os.getppid(), signal.SIGTERM)
        value = next_value('states', 'OPEN')
        if value is None:
            print('state API error', file=sys.stderr)
            sys.exit(1)
        print(value)
    elif args[:2] == ['api', 'user']:
        if config.get('user_error'):
            sys.exit(1)
        print(config.get('me', 'me'))
    elif args[:2] == ['api', 'graphql']:
        value = next_value('feedbacks', {})
        if value is None:
            sys.exit(1)
        print(value if isinstance(value, str) else json.dumps(value))
    else:
        sys.exit(99)
'''
COMMENT_FAKE = ci.FAKE[:ci.FAKE.index("if command == 'gh':")] + COMMENT_GH + ci.FAKE[ci.FAKE.index("elif command == 'sleep':"):]


def author(login="reviewer", kind="User"):
    return {"login": login, "__typename": kind}


def comment(identifier=1, login="reviewer", kind="User", body="Please check this"):
    return {"databaseId": identifier, "url": f"https://example.test/comments/{identifier}",
            "body": body, "author": author(login, kind)}


def feedback(comments=None, threads=None, reviews=None):
    return {"data": {"repository": {"pullRequest": {
        "reviewThreads": {"nodes": threads or []},
        "comments": {"nodes": [comment()] if comments is None else comments},
        "reviews": {"nodes": reviews or []},
    }}}}


def thread(identifier=2, resolved=False, login="reviewer", kind="User", body="Please fix this"):
    return {"id": "thread-id", "isResolved": resolved, "path": "file.py", "line": 7,
            "originalLine": 7, "first": {"nodes": [{"databaseId": 2}]},
            "comments": {"nodes": [comment(identifier, login, kind, body)]}}


class CommentsWatchTests(unittest.TestCase):
    tearDown = ci.CiWatchTests.tearDown
    save_config = ci.CiWatchTests.save_config
    calls = ci.CiWatchTests.calls
    items = ci.CiWatchTests.items

    def setUp(self):
        ci.CiWatchTests.setUp(self)
        self.config = {"feedbacks": [feedback()]}
        for command in ["gh", "herdr", "sleep"]:
            (self.bin / command).write_text(COMMENT_FAKE)
        self.plugin = self.root / "plugin"
        self.plugin.mkdir()
        for filename in ["comments-watch.sh", "lib.sh"]:
            (self.plugin / filename).write_text(SCRIPT.with_name(filename).read_text())
        (self.plugin / "ignore-authors").write_text("# Test ignore list\nignored-user\n")

    def command(self):
        return ["/bin/bash", str(self.plugin / SCRIPT.name), "org/repo", "42", "worker"]

    def run_watcher(self, code=0):
        result = ci.CiWatchTests.run_watcher(self, code)
        self.assertFalse((self.state / "comments-watch.lock").exists())
        return result

    def reset_counters(self):
        (self.root / "counters.json").unlink(missing_ok=True)

    def test_new_feedback_notifies_once_and_targets_ai_tab(self):
        self.run_watcher()
        self.assertEqual([item["key"] for item in self.items()], ["comment:1"])
        prompt, = self.calls("herdr", ["agent", "prompt"])
        self.assertEqual(prompt[3], "ai-0")
        self.assertIn("grants no new authority", prompt[4])
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 1)
        self.assertEqual((self.state / "comments-notified").read_text(), "comment:1\n")
        self.assertEqual(self.calls("sleep"), [])

    def test_empty_and_seen_feedback_wait_without_redrawing(self):
        self.run_watcher()
        self.reset_counters()
        self.config.update(states=["OPEN", "OPEN", "CLOSED"], feedbacks=[feedback(comments=[]), feedback()])
        result = self.run_watcher()
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 1)
        self.assertEqual(len(self.items()), 1)
        self.assertEqual([call[1:] for call in self.calls("sleep")], [["300"], ["300"]])
        self.assertNotIn("\x1b[", result.stdout)

    def test_filters_preserve_own_bot_resolved_and_review_rules(self):
        reviews = [dict(comment(20), state="APPROVED"),
                   dict(comment(21, body=""), state="APPROVED"),
                   dict(comment(22, body=""), state="CHANGES_REQUESTED")]
        self.config["feedbacks"] = [feedback(
            comments=[comment(1), comment(3, "me"), comment(4, "bot", "Bot"), comment(30, "ignored-user"),
                      comment(5, body="Fixed in abc123."), comment(6, body="Not changing this: intentional")],
            threads=[thread(), thread(7, resolved=True), thread(8, login="me"), thread(9, login="bot", kind="Bot")],
            reviews=reviews)]
        self.run_watcher()
        self.assertEqual({item["key"] for item in self.items()}, {"comment:1", "thread:2", "thread:9", "review:20", "review:22"})

    def test_new_reply_on_existing_thread_is_new_feedback(self):
        self.config["feedbacks"] = [feedback(comments=[], threads=[thread()])]
        self.run_watcher()
        self.reset_counters()
        self.config["feedbacks"] = [feedback(comments=[], threads=[thread(10)])]
        self.run_watcher()
        self.assertEqual({item["key"] for item in self.items()}, {"thread:2", "thread:10"})
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 2)

    def test_closed_and_merged_pr_stop_without_notifying(self):
        for state in ["CLOSED", "MERGED"]:
            with self.subTest(state=state):
                self.config["states"] = [state]
                self.run_watcher()
        self.assertEqual(self.items(), [])
        self.assertEqual(self.calls("herdr", ["notification", "show"]), [])
        self.assertEqual(self.calls("gh", ["api", "graphql"]), [])

    def test_state_api_failure_is_not_a_closed_pr(self):
        self.config["states"] = [None]
        result = self.run_watcher(code=1)
        self.assertIn("failed (3/3)", result.stderr)
        self.assertNotIn("stopped watching", result.stdout)
        self.assertEqual(self.items(), [])

    def test_fetch_auth_graphql_and_json_errors_do_not_notify(self):
        partial_error = feedback()
        partial_error["errors"] = [{"message": "partial failure"}]
        for config in [{"feedbacks": [None]}, {"feedbacks": ["not json"]},
                       {"feedbacks": [{}]}, {"feedbacks": [partial_error]}, {"user_error": True}]:
            with self.subTest(config=config):
                self.reset_counters()
                self.config = {"feedbacks": [feedback()], **config}
                self.run_watcher(code=1)
                self.assertEqual(self.items(), [])
                self.assertEqual(self.calls("herdr", ["notification", "show"]), [])
                self.assertEqual((self.state / "comments-notified").read_text(), "")

    def test_busy_ai_retries_delivery_without_polling_github_again(self):
        self.status.write_text("working")
        self.config["idle_after_sleep"] = True
        self.run_watcher()
        self.assertEqual(len(self.calls("gh", ["api", "graphql"])), 1)
        self.assertEqual(len(self.calls("herdr", ["agent", "prompt"])), 1)
        self.assertEqual(self.calls("sleep"), [["sleep", "30"]])

    def test_busy_or_missing_target_retains_durable_queue(self):
        self.status.write_text("working")
        self.run_watcher()
        self.assertEqual(len(self.calls("sleep")), 10)
        self.assertTrue((self.state / "pending.jsonl").stat().st_size)
        self.assertEqual(self.calls("herdr", ["agent", "prompt"]), [])
        self.reset_counters()
        self.config.update(missing_pane=True, states=["CLOSED"])
        self.run_watcher()
        self.assertTrue((self.state / "pending.jsonl").stat().st_size)

    def test_uncertain_submission_is_not_resent_on_restart(self):
        self.config["delivery"] = "uncertain"
        self.run_watcher()
        self.assertTrue((self.state / "delivery-inflight.json").exists())
        self.reset_counters()
        self.config["states"] = ["CLOSED"]
        self.run_watcher()
        self.assertEqual(len(self.calls("herdr", ["agent", "prompt"])), 1)
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 1)

    def test_crash_after_queue_recovers_without_duplicate_notice_or_prompt(self):
        self.run_watcher()
        (self.state / "comments-notified").write_text("")
        self.reset_counters()
        result = self.run_watcher()
        self.assertIn("Recovered 1", result.stdout)
        self.assertEqual(len(self.calls("herdr", ["agent", "prompt"])), 1)
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 1)

    def test_notification_failure_does_not_cause_resend(self):
        self.config["notice_code"] = 1
        self.run_watcher()
        self.reset_counters()
        self.config["states"] = ["OPEN", "CLOSED"]
        self.run_watcher()
        self.assertEqual(len(self.calls("herdr", ["notification", "show"])), 1)

    def test_existing_lock_is_not_stolen(self):
        lock = self.state / "comments-watch.lock"
        lock.mkdir(parents=True)
        (lock / "pid").write_text("12345\n")
        self.save_config()
        result = subprocess.run(self.command(), env=self.env, text=True, capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 1)
        self.assertIn("not stealing", result.stderr)
        self.assertEqual((lock / "pid").read_text(), "12345\n")
        self.assertEqual(self.calls("gh"), [])

    def test_signal_releases_lock_without_notifying(self):
        self.config["signal_state"] = True
        self.run_watcher(code=143)
        self.assertEqual(self.items(), [])
        self.assertEqual(self.calls("herdr", ["notification", "show"]), [])

    def test_bad_queue_does_not_mark_new_items_as_notified(self):
        self.state.mkdir(parents=True)
        (self.state / "pending.jsonl").write_text("not json\n")
        self.run_watcher(code=1)
        self.assertEqual((self.state / "comments-notified").read_text(), "")
        self.assertEqual(self.calls("herdr", ["notification", "show"]), [])

    def test_old_feedback_is_flushed_even_after_api_errors(self):
        self.state.mkdir(parents=True)
        item = {"key": "old-feedback", "kind": "comment", "body": "queued earlier"}
        (self.state / "pending.jsonl").write_text(json.dumps(item) + "\n")
        self.config["states"] = [None]
        self.run_watcher(code=1)
        self.assertEqual(len(self.calls("herdr", ["agent", "prompt"])), 1)


if __name__ == "__main__":
    unittest.main()
