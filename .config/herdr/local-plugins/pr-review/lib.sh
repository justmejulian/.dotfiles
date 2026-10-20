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
