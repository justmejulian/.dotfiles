# PR review workspaces and watchers

## Opening and restoring

The palette action **PR review: open workspace for this branch** finds the unique
Pi in the source development workspace's `ai` tab. It opens a background workspace
named `review - <repo>#<PR>` with Neovim/Atlas on the left, CI on the upper right,
and comments on the lower right. The workspace and panes keep the original source
checkout as cwd, never an Atlas disposable worktree. Watcher commands keep the
original development Pi pane as their anchor; feedback resolves the `ai` tab in
that source workspace, not in the review workspace.

There is one saved review workspace per source workspace + owner/repository + PR.
Records under `~/.cache/pr-review/workspaces/` contain that identity, live workspace,
tab and pane IDs, cwd, source anchor and commands. Reopening reuses a record only
if its workspace label and all saved IDs/memberships still match. Names alone
never select a workspace, so different owners or development workspaces can have
the same display label. Reuse does not restart Neovim or watchers. Stale records
are discarded without closing or modifying their old workspace/panes.

The startup hook restores valid saved workspaces and still supports legacy
`tabs/<tab-id>` records, including converting old `tuicr pr` commands to Atlas.
Existing review tabs are not adopted, moved or closed. `workspace-setup/setup.sh`
reserves the `review - ` prefix and skips its Pi/utility-tab setup before doing
any layout changes. The label is supplied on workspace creation to avoid a hook
race; do not use that prefix for normal development workspaces.

## Atlas / CodeDiff LSP

`~/.config/nvim/lua/config/plugins/atlas.lua` keeps CodeDiff and enables Atlas LSP
worktrees at:

```text
/Users/julianvisser/.herdr/worktrees/app/atlas/<owner>/<repo>/pr-<number>/nvim-<pid>
```

Components are sanitized; non-PR views use `head-<sha>` and missing repository
metadata falls back to `local/<checkout-name>`. Each Neovim process has its own
leaf because Atlas's active-worktree claims are only process-local. Atlas adds
suffixes for simultaneous views within a process. `node_modules` is symlinked
from the source checkout, not copied; dependency contents are shared.

These leaves are disposable: Atlas uses `git worktree remove --force` on close.
Never configure the source checkout or the `atlas/` parent as the worktree leaf,
and do not keep edits there. Crashes or failed cleanup can leave worktrees; inspect
them before any manual cleanup. This config does not install/start language servers.

Script changes apply on the next action/hook invocation. The palette title may
need a plugin reload; startup restoration runs on the next normal Herdr startup.
New Neovim processes load the Atlas config; existing Neovim instances/watchers
are not restarted or migrated automatically. Offline checks do not establish live
Herdr layout, CodeDiff navigation or LSP attachment.

`ci-watch.sh <owner/repo> <pr-number> <pi-pane>` wraps:

```sh
gh pr checks <pr-number> --repo <owner/repo> --watch --interval 30
```

It uses GitHub CLI's progress display and waits for all PR checks, including
non-Actions checks. It does not stop at the first failure. No Enhance install,
model process or workflow engine is required.

## Completion

A stable completed pass or failure produces a Herdr notification and a durable
feedback item for the unique Pi in the source development workspace's `ai` tab. The item includes
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
again in the CI pane for another cycle, or close the review workspace and reopen
from the source development workspace. Reopening an existing review workspace
does not restart a finished watcher.
An already-running old watcher must be stopped and restarted to use this version.

If Pi is busy, delivery is retried every 30 seconds for up to five minutes,
without polling GitHub again. Missing/ambiguous targets and uncertain submissions
are held rather than repeatedly sent. Undelivered items remain in the shared
queue; the comments watcher or another invocation can attempt delivery later.
An uncertain submission requires reconciliation before automatic delivery resumes.

## Comments

`comments-watch.sh <owner/repo> <pr-number> <pi-pane>` is also one-shot: it waits
for the first batch of new eligible feedback, notifies Herdr, queues it for Pi,
and exits after the same bounded delivery handling used by the CI watcher.
GitHub CLI has no native comment-watch command, so it uses `gh api` every five
minutes, or immediately when Enter is pressed. There is no continuously
redrawing comment dashboard. Existing unseen feedback counts as new; already
recorded comment IDs do not.

It preserves the existing filters: unresolved review threads (including bots),
human PR comments, and human reviews with a body or requested changes. Own
comments, configured `ignore-authors`, resolved threads and known self-reply
prefixes are excluded. A new reply in a thread is a new item; edits to an already
recorded comment ID are not. The existing query covers the first 100 review
threads, latest 50 PR comments and latest 50 reviews; pagination is not added.

Merged/closed PRs stop the watcher. Authentication, GraphQL, malformed-data and
PR-state errors are not mistaken for closure or empty feedback: they retry at
the normal interval and exit nonzero after three consecutive failures. Durable
older feedback can still be delivered during error handling. Both watchers use
the shared queue, immutable batch receipts and uncertain-submission hold.

Run the same command again to wait for the next batch. Restart existing comment
watchers to load this version; running panes are not replaced automatically.

## Duplicate protection

State defaults to `~/.cache/pr-review/<owner>_<repo>_<pr>/`; tests override
`PR_REVIEW_STATE`. Per-PR `ci-watch.lock` and `comments-watch.lock` directories
prevent concurrent instances of each watcher. Normal
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
for script in ~/.config/herdr/local-plugins/pr-review/*.sh ~/.config/herdr/local-plugins/workspace-setup/setup.sh; do
  bash -n "$script" || exit
done
```

Tests use temporary state and fake `gh`/`herdr` commands; they do not access
GitHub, submit real prompts or produce real notifications. Workspace tests cover
identity reuse, stale IDs, source-anchor feedback, setup exclusion and legacy
restoration. Atlas path tests use LuaJIT with a minimal `vim` stub (skipped when
LuaJIT is unavailable); they never load plugins or create/delete worktrees.
