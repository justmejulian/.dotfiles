#!/usr/bin/env bash
# Open a "PR review" tab next to pi: tuicr on the PR (left), the CI watcher
# (right top) and the comments watcher (right bottom). Opens in the background
# with a notification; does nothing if the workspace already has the tab.
#
#   open.sh <repo-dir> [<pr number or url>] <pi-pane>
#
# Without a PR, uses the PR of the checked-out branch.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

dir=$1 ref=${2:-} pi=$3
cd "$dir"

url=$(gh pr view ${ref:+"$ref"} --json url -q .url)
repo=$(sed -E 's#^https://github.com/([^/]+/[^/]+)/pull/.*#\1#' <<<"$url")
pr=${url##*/}

ws=$("$herdr" pane get "$pi" | jq -r '.result.pane.workspace_id')

existing=$("$herdr" tab list --workspace "$ws" |
  jq -r '.result.tabs[] | select(.label == "PR review") | .tab_id' | head -1)
if [ -n "$existing" ]; then
  echo "workspace $ws already has a PR review tab ($existing)"
  exit 0
fi

tuicr_pane=$("$herdr" tab create --workspace "$ws" --cwd "$dir" --label "PR review" --no-focus |
  jq -r '.result.root_pane.pane_id')
tab=$("$herdr" pane get "$tuicr_pane" | jq -r '.result.pane.tab_id')
ci_pane=$("$herdr" pane split "$tuicr_pane" --direction right --ratio 0.6 --cwd "$dir" |
  jq -r '.result.pane.pane_id')
comments_pane=$("$herdr" pane split "$ci_pane" --direction down --cwd "$dir" |
  jq -r '.result.pane.pane_id')

q() { printf '%q' "$1"; }
tuicr_cmd="tuicr pr $pr"
ci_cmd="$(q "$plugin_dir/ci-watch.sh") $repo $pr $pi"
comments_cmd="$(q "$plugin_dir/comments-watch.sh") $repo $pr $pi"

"$herdr" pane run "$tuicr_pane" "$tuicr_cmd" >/dev/null
"$herdr" pane run "$ci_pane" "$ci_cmd" >/dev/null
"$herdr" pane run "$comments_pane" "$comments_cmd" >/dev/null

# What runs where, so restore.sh can restart it after a herdr restart.
mkdir -p "$state_root/tabs"
printf '%s\t%s\n' "$tuicr_pane" "$tuicr_cmd" "$ci_pane" "$ci_cmd" "$comments_pane" "$comments_cmd" \
  >"$state_root/tabs/$tab"

"$herdr" notification show "PR review opened" --body "$repo#$pr in workspace $ws" >/dev/null || true
echo "opened PR review for $repo#$pr in $tab"
