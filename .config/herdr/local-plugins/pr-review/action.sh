#!/usr/bin/env bash
# cmd+k palette action: open the PR review tab for the focused workspace's
# branch, sending feedback to the pi agent in that workspace.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

ws=$(jq -r '.workspace_id' <<<"$HERDR_PLUGIN_CONTEXT_JSON")
pi=$("$herdr" pane list --workspace "$ws" |
  jq -r '[.result.panes[] | select(.agent == "pi")][0] | .pane_id // empty')
[ -n "$pi" ] || { "$herdr" notification show "PR review" --body "No pi agent in this workspace" >/dev/null; exit 1; }
cwd=$("$herdr" pane get "$pi" | jq -r '.result.pane.cwd')

exec bash "$plugin_dir/open.sh" "$cwd" "" "$pi"
