#!/usr/bin/env bash
# PR review tab, right bottom: open review feedback on the PR, refreshed every
# 5 minutes. New items are sent to pi once.
#
# Sent: unresolved review threads whose latest comment isn't mine (bots
# included), and PR comments and reviews from people (reviews only when they
# request changes or have a body). Logins in ignore-authors are skipped.
#
#   comments-watch.sh <owner/repo> <number> <pi-pane>
set -uo pipefail
source "$(dirname "$0")/lib.sh"

repo=$1 pr=$2 pi=$3
notified="$(state_dir "$repo" "$pr")/comments-notified" # lines: <item key>
touch "$notified"
me=$(gh api user -q .login)
ignore=$(grep -v '^#' "$plugin_dir/ignore-authors" 2>/dev/null | jq -R . | jq -s .)

query='query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){
  reviewThreads(first:100){nodes{isResolved path line
    comments(last:1){nodes{databaseId url body author{login __typename}}}}}
  comments(last:50){nodes{databaseId url body author{login __typename}}}
  reviews(last:50){nodes{databaseId url body state author{login __typename}}}}}}'

# Prints one line per open item: <key>\t<author>\t<where>\t<url>\t<body>
fetch_items() {
  gh api graphql -F owner="${repo%/*}" -F repo="${repo#*/}" -F pr="$pr" -f query="$query" |
    jq -r --arg me "$me" --argjson ignore "${ignore:-[]}" '
      def who: .login + (if .__typename == "Bot" then "[bot]" else "" end);
      def skip: .login == $me or (.login | IN($ignore[]));
      .data.repository.pullRequest
      | ( .reviewThreads.nodes[]
          | select(.isResolved | not)
          | .comments.nodes[0] as $c
          | select($c.author | skip | not)
          | ["thread:\($c.databaseId)", ($c.author | who), "\(.path):\(.line // "?")", $c.url, $c.body] ),
        ( .comments.nodes[]
          | select(.author.__typename != "Bot" and (.author | skip | not))
          | ["comment:\(.databaseId)", (.author | who), "PR", .url, .body] ),
        ( .reviews.nodes[]
          | select(.author.__typename != "Bot" and (.author | skip | not))
          | select(.state == "CHANGES_REQUESTED" or (.body | length > 0))
          | ["review:\(.databaseId)", (.author | who), "review (\(.state | ascii_downcase))", .url, .body] )
      | map(tostring | gsub("[\t\r\n]+"; " ")) | @tsv'
}

while :; do
  clear
  echo "Comments · $repo#$pr · $(date +%H:%M)"
  echo

  if ! pr_open "$repo" "$pr"; then
    echo "PR is no longer open, stopped watching."
    exit 0
  fi

  if ! items=$(fetch_items); then
    echo "! couldn't fetch comments, retrying next check"
    wait_refresh
    continue
  fi

  if [ -z "$items" ]; then
    echo "no open feedback"
  else
    while IFS=$'\t' read -r key author where url body; do
      mark=" "; grep -qxF "$key" "$notified" && mark="✓"
      echo "$mark $where  @$author"
      echo "    $(oneline 110 <<<"$body")"
    done <<<"$items"
    echo; echo "✓ = already sent to pi"
  fi

  new="" keys=""
  while IFS=$'\t' read -r key author where url body; do
    [ -n "$key" ] || continue
    grep -qxF "$key" "$notified" && continue
    new+="- $where, @$author: $(oneline 300 <<<"$body") ($url)"$'\n'
    keys+="$key"$'\n'
  done <<<"$items"

  if [ -n "$new" ]; then
    msg="New review feedback on PR #$pr ($repo):
$new
For each item, first check whether it's valid: a real problem in this PR, not theoretical, and worth a proportionate fix without over-engineering. Fix the valid ones locally with a commit each, and tell me which you skipped and why. Don't push, reply or resolve threads until I confirm."
    if ask_pi "$pi" "$msg"; then
      printf '%s' "$keys" >>"$notified"
      echo; echo "→ sent $(grep -c . <<<"$keys") new item(s) to pi"
    else
      echo; echo "! couldn't reach pi ($pi), retrying next check"
    fi
  fi

  wait_refresh
done
