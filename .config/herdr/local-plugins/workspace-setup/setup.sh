#!/usr/bin/env bash
# workspace.created hook: name the first tab "ai" and start pi in it. In a git
# repo, add a "lazygit" tab, then a "serve" tab if the repo has a serve command
# in serve.conf.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

ws="${HERDR_WORKSPACE_ID:-$(jq -r '.. | .workspace_id? // empty' <<<"${HERDR_PLUGIN_EVENT_JSON:-{\}}" | head -1)}"
[ -n "$ws" ] || { echo "no workspace id in event" >&2; exit 1; }

read -r first_pane first_tab cwd < <("$herdr" pane list --workspace "$ws" |
  jq -r '.result.panes[0] | "\(.pane_id) \(.tab_id) \(.cwd // "")"')
[ -n "$cwd" ] || cwd="$HOME"

# pi's herdr integration resumes this session after a restart, so restore.sh
# doesn't need to start it again.
"$herdr" tab rename "$first_tab" ai >/dev/null
"$herdr" pane run "$first_pane" pi >/dev/null

if is_git_repo "$cwd"; then
  git_pane=$("$herdr" tab create --workspace "$ws" --cwd "$cwd" --label lazygit --no-focus |
    jq -r '.result.root_pane.pane_id')
  "$herdr" pane run "$git_pane" lazygit >/dev/null
fi

cmd=$(serve_cmd "$cwd")

if [ -n "$cmd" ]; then
  pane=$("$herdr" tab create --workspace "$ws" --cwd "$cwd" --label serve --no-focus |
    jq -r '.result.root_pane.pane_id')
  "$herdr" pane run "$pane" "$cmd" >/dev/null
fi
