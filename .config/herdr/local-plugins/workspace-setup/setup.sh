#!/usr/bin/env bash
# workspace.created hook: name the first tab "ai" and start pi --orchestrator in it. In a git
# repo, add a "lazygit" tab, then a "serve" tab if the repo has serve steps
# in serve.conf. Always add an empty "shell" tab without changing focus.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

ws="${HERDR_WORKSPACE_ID:-$(jq -r '.. | .workspace_id? // empty' <<<"${HERDR_PLUGIN_EVENT_JSON:-{\}}" | head -1)}"
[ -n "$ws" ] || { echo "no workspace id in event" >&2; exit 1; }

label=$("$herdr" workspace get "$ws" | jq -er '.result.workspace.label // ""')
case "$label" in 'review - '*) exit 0 ;; esac

read -r first_pane first_tab cwd < <("$herdr" pane list --workspace "$ws" |
  jq -r '.result.panes[0] | "\(.pane_id) \(.tab_id) \(.cwd // "")"')
[ -n "$cwd" ] || cwd="$HOME"

# Open the conversational development orchestrator directly in the workspace cwd.
# restore.sh continues to handle only the utility tabs.
"$herdr" tab rename "$first_tab" ai >/dev/null
"$herdr" pane run "$first_pane" "pi --orchestrator" >/dev/null

if is_git_repo "$cwd"; then
  git_pane=$("$herdr" tab create --workspace "$ws" --cwd "$cwd" --label lazygit --no-focus |
    jq -r '.result.root_pane.pane_id')
  "$herdr" pane run "$git_pane" lazygit >/dev/null
fi

if [ -n "$(serve_steps "$cwd")" ]; then
  pane=$("$herdr" tab create --workspace "$ws" --cwd "$cwd" --label serve --no-focus |
    jq -r '.result.root_pane.pane_id')
  run_serve_steps "$pane" "$cwd"
fi

"$herdr" tab create --workspace "$ws" --cwd "$cwd" --label shell --no-focus >/dev/null
