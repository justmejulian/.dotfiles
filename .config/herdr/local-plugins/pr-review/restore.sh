#!/usr/bin/env bash
# Startup hook: restore saved review workspaces and legacy review tabs.
set -uo pipefail
source "$(dirname "$0")/lib.sh"

shopt -s nullglob
for file in "$state_root"/workspaces/*.json; do
  if ! review_workspace_live "$file"; then
    rm -f "$file"
    continue
  fi
  while IFS= read -r entry; do
    pane=$(jq -r .pane <<<"$entry")
    cmd=$(jq -r .command <<<"$entry")
    "$herdr" pane run "$pane" "$cmd" >/dev/null
  done < <(jq -c '.commands[]' "$file")
done

for file in "$state_root"/tabs/*; do
  tab=$(basename "$file")
  label=$("$herdr" tab get "$tab" 2>/dev/null | jq -r '.result.tab.label // empty')
  if [ "$label" != "PR review" ]; then
    rm -f "$file"
    continue
  fi
  while IFS=$'\t' read -r pane cmd; do
    case "$cmd" in
      'tuicr pr '*) cmd=$(review_command "${cmd#tuicr pr }") ;;
    esac
    live=$("$herdr" pane get "$pane" 2>/dev/null) || continue
    if jq -e --arg tab "$tab" '.result.pane.tab_id == $tab' <<<"$live" >/dev/null; then
      "$herdr" pane run "$pane" "$cmd" >/dev/null
    fi
  done <"$file"
done
