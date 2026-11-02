#!/usr/bin/env bash
# cmd+k palette action: open a PR review workspace for the focused workspace's
# branch, sending feedback to the pi agent in that workspace.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

ws=$(jq -r '.workspace_id' <<<"$HERDR_PLUGIN_CONTEXT_JSON")
pi=$(find_ai_pi "$ws") || { "$herdr" notification show "PR review" --body "Need exactly one Pi in this workspace's ai tab" --sound none >/dev/null; exit 1; }
cwd=$("$herdr" pane get "$pi" | jq -r '.result.pane.cwd')

exec bash "$plugin_dir/open.sh" "$cwd" "" "$pi"
