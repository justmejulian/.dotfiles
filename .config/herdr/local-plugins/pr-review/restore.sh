#!/usr/bin/env bash
# Startup hook: herdr restores "PR review" tabs as plain shells. Restart tuicr
# and the watchers in them from what open.sh saved; forget closed tabs.
set -uo pipefail
source "$(dirname "$0")/lib.sh"

shopt -s nullglob
for file in "$state_root"/tabs/*; do
  tab=$(basename "$file")
  label=$("$herdr" tab get "$tab" 2>/dev/null | jq -r '.result.tab.label // empty')
  if [ "$label" != "PR review" ]; then
    rm -f "$file"
    continue
  fi
  while IFS=$'\t' read -r pane cmd; do
    "$herdr" pane get "$pane" >/dev/null 2>&1 && "$herdr" pane run "$pane" "$cmd" >/dev/null
  done <"$file"
done
