#!/usr/bin/env bash
# PR review tab, right bottom: open review feedback on the PR, refreshed every
# 5 minutes. New items are queued once and handed to an address-feedback run
# (see launch_pending in lib.sh).
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
  reviewThreads(first:100){nodes{id isResolved path line originalLine
    first: comments(first:1){nodes{databaseId}}
    comments(last:1){nodes{databaseId url body author{login __typename}}}}}
  comments(last:50){nodes{databaseId url body author{login __typename}}}
  reviews(last:50){nodes{databaseId url body state author{login __typename}}}}}}'

# Prints one JSON object per open item, in the shape address-feedback reads.
fetch_items() {
  gh api graphql -F owner="${repo%/*}" -F repo="${repo#*/}" -F pr="$pr" -f query="$query" |
    jq -c --arg me "$me" --argjson ignore "${ignore:-[]}" '
      def who: .login + (if .__typename == "Bot" then "[bot]" else "" end);
      def skip: .login == $me or (.login | IN($ignore[]));
      def item($key; $kind; $author; $where; $url; $body):
        {key: $key, kind: $kind, author: ($author | who), authorIsBot: ($author.__typename == "Bot"),
         where: $where, url: $url, body: ($body | gsub("[\t\r\n]+"; " "))};
      .data.repository.pullRequest
      | ( .reviewThreads.nodes[]
          | select(.isResolved | not)
          | .comments.nodes[0] as $c
          | select($c.author | skip | not)
          | item("thread:\($c.databaseId)"; "thread"; $c.author; "\(.path):\(.line // .originalLine // "?")"; $c.url; $c.body)
            + {threadId: .id, commentId: .first.nodes[0].databaseId} ),
        ( .comments.nodes[]
          | select(.author.__typename != "Bot" and (.author | skip | not))
          | item("comment:\(.databaseId)"; "comment"; .author; "PR"; .url; .body) ),
        ( .reviews.nodes[]
          | select(.author.__typename != "Bot" and (.author | skip | not))
          | select(.state == "CHANGES_REQUESTED" or (.body | length > 0))
          | item("review:\(.databaseId)"; "review"; .author; "review (\(.state | ascii_downcase))"; .url; .body) )'
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
    while IFS= read -r item; do
      key=$(jq -r .key <<<"$item")
      mark=" "; grep -qxF "$key" "$notified" && mark="✓"
      echo "$mark $(jq -r '"\(.where)  @\(.author)"' <<<"$item")"
      echo "    $(jq -r .body <<<"$item" | oneline 110)"
    done <<<"$items"
    echo; echo "✓ = already handed on"
  fi

  new=""
  while IFS= read -r item; do
    [ -n "$item" ] || continue
    key=$(jq -r .key <<<"$item")
    grep -qxF "$key" "$notified" && continue
    new+="$item"$'\n'
    printf '%s\n' "$key" >>"$notified"
  done <<<"$items"
  if [ -n "$new" ]; then
    queue_items "$repo" "$pr" "$new"
    echo; echo "+ queued $(grep -c . <<<"$new") new item(s)"
  fi
  echo; launch_pending "$repo" "$pr" "$pi"

  wait_refresh
done
