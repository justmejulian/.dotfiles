#!/usr/bin/env bash
# Print a feedback batch for a PR: every failed check on its head commit and
# every open comment item, ignoring what the watchers already handed on. Used
# when /workflow address-feedback runs without a batch from the watchers.
#
#   collect.sh <owner/repo> <number>
set -euo pipefail
source "$(dirname "$0")/lib.sh"

repo=$1 pr=$2
url=$(gh pr view "$pr" -R "$repo" --json url -q .url)
{ fetch_ci_items "$repo" "$pr"; fetch_comment_items "$repo" "$pr"; } |
  jq -s --arg repo "$repo" --argjson pr "$pr" --arg url "$url" '{repo: $repo, pr: $pr, url: $url, items: .}'
