#!/usr/bin/env bash
# One shot: wait for new eligible PR feedback, notify, enqueue, then exit.
# GitHub CLI has no native comment-watch mode; poll its API every five minutes.
# comments-watch.sh <owner/repo> <number> <pi-pane>
set -uo pipefail
source "$(dirname "$0")/lib.sh"

if [ "$#" -ne 3 ] || ! [[ "$2" =~ ^[1-9][0-9]*$ ]]; then
  echo "usage: $0 <owner/repo> <number> <pi-pane>" >&2
  exit 2
fi
repo=$1 pr=$2 pi_pane=$3
dir=$(state_dir "$repo" "$pr") || exit 1
notified="$dir/comments-notified"
lock="$dir/comments-watch.lock"
if ! mkdir "$lock" 2>/dev/null; then
  echo "! comments watcher already locked: $lock (not stealing; reconcile stale locks manually)" >&2
  exit 1
fi
trap 'rm -f "$lock/pid"; rmdir "$lock" 2>/dev/null || true' EXIT
trap 'echo "! comments watch cancelled (INT)" >&2; exit 130' INT
trap 'echo "! comments watch cancelled (TERM)" >&2; exit 143' TERM
printf '%s\n' "$$" >"$lock/pid" || exit 1
touch "$notified" || exit 1

watch_comments() {
  local state items new item key marks failures=0 recovered count digest notice
  echo "Watching new feedback for $repo#$pr (five-minute checks; Enter checks now)."
  while :; do
    state=$(gh pr view "$pr" --repo "$repo" --json state -q .state) || state=""
    case "$state" in
      CLOSED|MERGED) echo "PR is $state; stopped watching."; return 0 ;;
      OPEN)
        if items=$(fetch_comment_items "$repo" "$pr") &&
          items=$(jq -sce '
            if all(.[]; type == "object"
              and (.key | type == "string" and length > 0)
              and (.kind | IN("thread", "comment", "review"))
              and ([.where, .author, .url, .body] | all(type == "string")))
            then unique_by(.key) else error("invalid feedback items") end' <<<"$items"); then
          items=$(jq -c '.[]' <<<"$items") || return 1
          failures=0
        else
          state=""
        fi ;;
    esac
    if [ "$state" != OPEN ]; then
      failures=$((failures + 1))
      echo "! GitHub feedback fetch failed ($failures/3); not treating this as a closed PR" >&2
      [ "$failures" -lt 3 ] || return 1
      launch_pending "$repo" "$pr" "$pi_pane" || return 1
      wait_refresh
      continue
    fi

    new="" marks="" recovered=0
    while IFS= read -r item; do
      [ -n "$item" ] || continue
      key=$(jq -r .key <<<"$item") || return 1
      grep -qxF "$key" "$notified" && continue
      if feedback_was_queued "$repo" "$pr" "$key"; then
        printf '%s\n' "$key" >>"$notified" || return 1
        recovered=$((recovered + 1))
        continue
      fi
      new+="$item"$'\n'
      marks+="$key"$'\n'
    done <<<"$items"
    if [ -n "$new" ]; then
      queue_items "$repo" "$pr" "$new" || return 1
      printf '%s' "$marks" >>"$notified" || return 1
      count=$(jq -s length <<<"$new") || return 1
      echo "→ queued $count new feedback item(s) for $repo#$pr"
      jq -r '"  \(.where)  @\(.author)\n  \(.url)"' <<<"$new"
      digest=$(printf '%s' "$marks" | shasum -a 256) || return 1
      digest=${digest%% *}
      mkdir -p "$dir/comment-notices" || return 1
      notice="$dir/comment-notices/$digest.attempted"
      if [ ! -f "$notice" ]; then
        : >"$notice" || return 1
        "$herdr" notification show "PR feedback · $repo#$pr" \
          --body "$count new item(s) · https://github.com/$repo/pull/$pr" >/dev/null || \
          echo "! notification attempt failed; not automatically resending" >&2
      fi
      return 0
    fi
    if [ "$recovered" -gt 0 ]; then
      echo "Recovered $recovered already-queued feedback item(s); not notifying twice."
      return 0
    fi
    launch_pending "$repo" "$pr" "$pi_pane" || return 1
    echo "No new eligible feedback; waiting."
    wait_refresh
  done
}

watch_comments
result=$?
deliver_pending_feedback "$repo" "$pr" "$pi_pane" || { [ "$result" -ne 0 ] || result=1; }
exit "$result"
