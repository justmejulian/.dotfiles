# Shared by the pr-review scripts.

herdr="${HERDR_BIN_PATH:-herdr}"
plugin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
state_root="${PR_REVIEW_STATE:-$HOME/.cache/pr-review}"
interval=300 # seconds between watcher refreshes

# state_dir <owner/repo> <number>: per-PR state, e.g. what pi was already told.
state_dir() {
  local dir="$state_root/$(printf '%s' "$1" | tr '/' '_')_$2"
  mkdir -p "$dir"
  printf '%s' "$dir"
}

# ask_pi <pane> <text>: submit a prompt to pi. Fails when pi is gone or blocked
# on a question; callers keep the item and retry on the next refresh.
ask_pi() {
  "$herdr" agent prompt "$1" "$2" >/dev/null 2>&1
}

# pi_idle <pane>: pi is waiting for input (typing a /command now runs it).
pi_idle() {
  case "$("$herdr" agent get "$1" 2>/dev/null | jq -r '.result.agent.agent_status // .result.agent.status // empty')" in
    idle | done) return 0 ;;
    *) return 1 ;;
  esac
}

# run_active <owner/repo> <number>: an address-feedback run for this PR is
# still going. Its marker is stale once pi-workflows lists the run as finished
# or after 24 hours (a cancelled run never removes it).
run_active() {
  local marker="$state_root/active/$(printf '%s' "$1" | tr '/' '_')_$2" run
  [ -f "$marker" ] || return 1
  if [ -n "$(find "$marker" -mmin +1440)" ]; then rm -f "$marker"; return 1; fi
  run=$(head -1 "$marker")
  # Written by launch_pending until the run's setup step records its id.
  if [ "${run%% *}" = launching ]; then
    if [ -n "$(find "$marker" -mmin +10)" ]; then rm -f "$marker"; return 1; fi
    return 0
  fi
  if pi-workflows runs 2>/dev/null | grep -F "$run" | grep -qiE 'completed|failed|cancel'; then
    rm -f "$marker"; return 1
  fi
  return 0
}

# queue_items <owner/repo> <number> <json lines>: add feedback items to the PR's
# pending batch, skipping keys already queued. Both watchers share the file.
queue_items() {
  local dir pending lock
  dir=$(state_dir "$1" "$2"); pending="$dir/pending.jsonl"; lock="$dir/pending.lock"
  until mkdir "$lock" 2>/dev/null; do sleep 1; done
  touch "$pending"
  while IFS= read -r item; do
    [ -n "$item" ] || continue
    grep -qF "\"key\":$(jq -c .key <<<"$item")," "$pending" || printf '%s\n' "$item" >>"$pending"
  done <<<"$3"
  rmdir "$lock"
}

# launch_pending <owner/repo> <number> <pi-pane>: start one address-feedback run
# with everything queued, when no run is active and pi is idle. Prints a status.
launch_pending() {
  local dir pending lock batch url count
  dir=$(state_dir "$1" "$2"); pending="$dir/pending.jsonl"; lock="$dir/pending.lock"
  [ -s "$pending" ] || return 0
  count=$(grep -c . "$pending")
  if run_active "$1" "$2"; then echo "⏸ $count item(s) held: an address-feedback run is active"; return 0; fi
  if ! pi_idle "$3"; then echo "⏸ $count item(s) queued: waiting for pi ($3) to be idle"; return 0; fi
  until mkdir "$lock" 2>/dev/null; do sleep 1; done
  url=$(gh pr view "$2" -R "$1" --json url -q .url)
  batch="$dir/batch-$(date +%Y%m%d-%H%M%S).json"
  jq -s --arg repo "$1" --argjson pr "$2" --arg url "$url" '{repo: $repo, pr: $pr, url: $url, items: .}' "$pending" >"$batch"
  if ask_pi "$3" "/workflow address-feedback --input-json $(jq -cn --arg f "$batch" '{file: $f}')"; then
    : >"$pending"
    mkdir -p "$state_root/active"
    echo "launching $(date +%s)" >"$state_root/active/$(printf '%s' "$1" | tr '/' '_')_$2"
    echo "→ started address-feedback with $count item(s)"
  else
    rm -f "$batch"
    echo "! couldn't reach pi ($3), retrying next check"
  fi
  rmdir "$lock"
}

# wait_refresh: sleep until the next refresh, or until Enter is pressed.
wait_refresh() {
  printf '\nnext check %s, Enter to check now ' "$(date -v+"${interval}"S +%H:%M)"
  read -r -t "$interval" _
  # Exit codes above 128 mean the timeout passed. Anything else non-zero is a
  # closed stdin, where read returns at once; sleep so the loop can't spin.
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -le 128 ]; then sleep "$interval"; fi
}

# pr_open <owner/repo> <number>: false once the PR is merged or closed.
pr_open() {
  [ "$(gh pr view "$2" -R "$1" --json state -q .state 2>/dev/null)" = OPEN ]
}

oneline() {
  tr '\n\r\t' '   ' | sed -E 's/  +/ /g; s/<!--[^>]*-->//g' | cut -c1-"${1:-200}"
}
