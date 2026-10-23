# PR review CI watcher

`ci-watch.sh <owner/repo> <pr-number> <pi-pane>` wraps:

```sh
gh pr checks <pr-number> --repo <owner/repo> --watch --interval 30
```

It uses GitHub CLI's progress display and waits for all PR checks, including
non-Actions checks. It does not stop at the first failure. No Enhance install,
model process or workflow engine is required.

## Completion

A stable completed pass or failure produces a Herdr notification and a durable
feedback item for the unique Pi in the workspace's `ai` tab. The item includes
the commit SHA, counts, and failed-check names and links. Existing delivery
permissions still apply: a notification does not authorize edits, pushes,
comments or reruns, and submission is not processing acknowledgement.

The wrapper checks the head SHA before watching, after watching, after fetching
the final summary, and before enqueueing. If it changes, the stale result is
discarded and the watch restarts, at most five times. Results explicitly name
their SHA; a push after the final check can still make a queued result historical.

Cancelled, pending, empty or invalid results and API errors are not reported as
completed CI. With no checks registered yet, the native watcher may return
immediately; start it again after checks appear.

## One shot, not a daemon

The script exits after this completion and its bounded delivery attempts. It
**does not automatically watch later pushes or reruns**. Run the same command
again in the CI pane for another cycle, or close and reopen the PR review tab.
An already-running old watcher must be stopped and restarted to use this version.

If Pi is busy, delivery is retried every 30 seconds for up to five minutes,
without polling GitHub again. Missing/ambiguous targets and uncertain submissions
are held rather than repeatedly sent. Undelivered items remain in the shared
queue; the comments watcher or another invocation can attempt delivery later.
An uncertain submission requires reconciliation before automatic delivery resumes.

## Duplicate protection

State defaults to `~/.cache/pr-review/<owner>_<repo>_<pr>/`; tests override
`PR_REVIEW_STATE`. A per-PR `ci-watch.lock` prevents concurrent watchers. Normal
exit and handled signals release it. A crash can leave a lock: inspect its `pid`
and confirm the owner has stopped before manually removing that lock. The script
never steals locks.

Completion identity includes the head SHA and a sorted fingerprint of check
names, states, links, timestamps, workflows and events. Changed rerun results can
therefore notify on the same SHA. If a provider reuses all those fields for a
rerun, it cannot be distinguished through this API and is deduplicated. This is
not a claim of exactly-once delivery. A Herdr notification is attempted once per
result, including when that attempt fails.

Exit zero means a completed result was recorded, **not that CI passed or Pi
processed it**. Cancellation and validation/API errors exit nonzero; previously
queued feedback can still be flushed after an API error.

## Offline tests

```sh
python3 -m unittest discover -s ~/.config/herdr/local-plugins/pr-review -p 'test_*.py' -v
bash -n ~/.config/herdr/local-plugins/pr-review/ci-watch.sh
```

Tests use temporary state and fake `gh`/`herdr` commands; they do not access
GitHub, submit real prompts or produce real notifications.
