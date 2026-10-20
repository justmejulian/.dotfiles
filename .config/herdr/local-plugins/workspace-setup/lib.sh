# Shared by setup.sh and restore.sh.

herdr="${HERDR_BIN_PATH:-herdr}"
plugin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# is_git_repo <dir>
is_git_repo() {
  git -C "$1" rev-parse --git-dir >/dev/null 2>&1
}

# serve_cmd <dir>: the serve.conf command for the repo containing <dir>, if any.
# Repo name comes from the main checkout, so ~/.herdr/worktrees/app/<branch> is "app".
serve_cmd() {
  local repo common
  repo=$(basename "$1")
  if common=$(git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null); then
    repo=$(basename "$(dirname "$common")")
  fi
  sed -n "s/^[[:space:]]*$repo[[:space:]]*=[[:space:]]*//p" "$plugin_dir/serve.conf" | head -1
}
