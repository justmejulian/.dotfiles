#!/usr/bin/env bash
# Startup hook: after a server restart herdr restores tabs as plain shells.
# Restart lazygit in "lazygit" tabs and rerun the serve steps in "serve" tabs.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

"$herdr" workspace list | jq -r '.result.workspaces[].workspace_id' | while read -r ws; do
  panes=$("$herdr" pane list --workspace "$ws")

  "$herdr" tab list --workspace "$ws" |
    jq -r '.result.tabs[] | select(.label == "lazygit" or .label == "serve") | "\(.tab_id)\t\(.label)"' |
    while IFS=$'\t' read -r tab label; do
      read -r pane cwd < <(jq -r --arg tab "$tab" \
        '[.result.panes[] | select(.tab_id == $tab)][0] | "\(.pane_id) \(.cwd)"' <<<"$panes")

      case "$label" in
        lazygit) "$herdr" pane run "$pane" lazygit >/dev/null ;;
        serve) run_serve_steps "$pane" "$cwd" ;;
      esac
    done
done
