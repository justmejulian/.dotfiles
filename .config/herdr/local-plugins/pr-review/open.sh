#!/usr/bin/env bash
# open.sh <source-checkout> [<pr number or url>] <source-pi-pane>
set -euo pipefail
source "$(dirname "$0")/lib.sh"

dir=$1 ref=${2:-} pi=$3
cd "$dir"
dir=$PWD

url=$(gh pr view ${ref:+"$ref"} --json url -q .url)
if [[ ! "$url" =~ ^https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/pull/([0-9]+)$ ]]; then
  echo "invalid GitHub PR URL: $url" >&2
  exit 1
fi
repo=${BASH_REMATCH[1]} pr=${BASH_REMATCH[2]}
ws=$("$herdr" pane get "$pi" | jq -er '.result.pane.workspace_id')
label="review - ${repo#*/}#$pr"

key=$(printf '%s\n' "$ws" "$repo" "$pr" | shasum -a 256)
key=${key%% *}
mkdir -p "$state_root/workspaces"
record="$state_root/workspaces/$key.json"
lock="$state_root/workspaces/$key.lock"
queue_lock "$lock"
trap 'rmdir "$lock" 2>/dev/null || true' EXIT
if [ -f "$record" ]; then
  if jq -e --arg ws "$ws" --arg repo "$repo" --arg pr "$pr" '
      .source_workspace == $ws and .repo == $repo and .pr == $pr' "$record" >/dev/null &&
    review_workspace_live "$record"; then
    echo "PR review for $repo#$pr already open in $(jq -r .workspace "$record")"
    exit 0
  fi
  rm -f "$record"
fi

created=$("$herdr" workspace create --cwd "$dir" --label "$label" --no-focus)
review_ws=$(jq -er '.result.workspace.workspace_id' <<<"$created")
review_pane=$(jq -er '.result.root_pane.pane_id' <<<"$created")
tab=$(jq -er '.result.tab.tab_id' <<<"$created")
"$herdr" tab rename "$tab" "PR review" >/dev/null
ci_pane=$("$herdr" pane split "$review_pane" --direction right --ratio 0.6 --cwd "$dir" --no-focus |
  jq -er '.result.pane.pane_id')
comments_pane=$("$herdr" pane split "$ci_pane" --direction down --cwd "$dir" --no-focus |
  jq -er '.result.pane.pane_id')

q() { printf '%q' "$1"; }
review_cmd=$(review_command "$url")
ci_cmd="$(q "$plugin_dir/ci-watch.sh") $(q "$repo") $(q "$pr") $(q "$pi")"
comments_cmd="$(q "$plugin_dir/comments-watch.sh") $(q "$repo") $(q "$pr") $(q "$pi")"

"$herdr" pane run "$review_pane" "$review_cmd" >/dev/null
"$herdr" pane run "$ci_pane" "$ci_cmd" >/dev/null
"$herdr" pane run "$comments_pane" "$comments_cmd" >/dev/null

jq -n --arg workspace "$review_ws" --arg label "$label" --arg tab "$tab" \
  --arg source_workspace "$ws" --arg source_pane "$pi" --arg cwd "$dir" \
  --arg repo "$repo" --arg pr "$pr" --arg review_pane "$review_pane" --arg review_cmd "$review_cmd" \
  --arg ci_pane "$ci_pane" --arg ci_cmd "$ci_cmd" --arg comments_pane "$comments_pane" --arg comments_cmd "$comments_cmd" '
  {workspace:$workspace, label:$label, tab:$tab, source_workspace:$source_workspace,
   source_pane:$source_pane, cwd:$cwd, repo:$repo, pr:$pr,
   commands:[{pane:$review_pane, command:$review_cmd}, {pane:$ci_pane, command:$ci_cmd},
             {pane:$comments_pane, command:$comments_cmd}]}' >"$record.tmp"
mv "$record.tmp" "$record"

"$herdr" notification show "PR review opened" --body "$repo#$pr in workspace $review_ws" >/dev/null || true
echo "opened PR review for $repo#$pr in $review_ws"
