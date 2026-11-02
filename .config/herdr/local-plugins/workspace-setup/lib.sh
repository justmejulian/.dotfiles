# Shared by setup.sh and restore.sh.

herdr="${HERDR_BIN_PATH:-herdr}"
plugin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# is_git_repo <dir>
is_git_repo() {
  git -C "$1" rev-parse --git-dir >/dev/null 2>&1
}

# repo_name <dir>: name of the repo containing <dir>. It comes from the main
# checkout, so ~/.herdr/worktrees/app/<branch> is "app".
repo_name() {
  local common
  if common=$(git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null); then
    basename "$(dirname "$common")"
  else
    basename "$1"
  fi
}

# serve_steps <dir>: the serve.conf steps for the repo containing <dir>, one per
# line, if any.
serve_steps() {
  sed -n "s/^[[:space:]]*$(repo_name "$1")[[:space:]]*=[[:space:]]*//p" "$plugin_dir/serve.conf"
}

# run_serve_steps <pane> <dir>: run the serve steps for <dir> in <pane> through
# run-steps.zsh, which records each step as its own history entry.
run_serve_steps() {
  "$herdr" pane run "$1" "source $plugin_dir/run-steps.zsh $(repo_name "$2")" >/dev/null
}
