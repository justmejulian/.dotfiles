#!/usr/bin/env bash
# Publish each workspace's number as the $num sidebar token, so the sidebar
# shows which ctrl+1..9 (switch_workspace in app.toml) goes where. Runs at
# startup and whenever workspaces are created, closed, moved or reordered.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

seq=$(python3 -c 'import time; print(time.time_ns() // 1000000)')

# The sidebar (and switch_workspace) lists linked worktrees under the workspace
# of their main checkout, so number them in that order, not by .number.
"$herdr" workspace list | jq -r '
  .result.workspaces as $all
  | ($all | map(select(.worktree.is_linked_worktree != true) | .worktree.repo_key // empty)) as $parents
  | [ $all[]
      | select(.worktree.is_linked_worktree != true or (.worktree.repo_key | IN($parents[]) | not))
      | ., (.worktree.repo_key // null) as $repo
         | if $repo and .worktree.is_linked_worktree != true
           then $all[] | select(.worktree.is_linked_worktree == true and .worktree.repo_key == $repo)
           else empty end ]
  | to_entries[] | "\(.value.workspace_id) \(.key + 1)"' |
  while read -r ws number; do
    "$herdr" workspace report-metadata "$ws" --source julian.workspace-numbers \
      --seq "$seq" --token "num=$number" >/dev/null
  done
