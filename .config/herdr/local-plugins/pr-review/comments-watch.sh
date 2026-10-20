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
while :; do
  clear
  echo "Comments · $repo#$pr · $(date +%H:%M)"
  echo

  if ! pr_open "$repo" "$pr"; then
    echo "PR is no longer open, stopped watching."
    exit 0
  fi

  if ! items=$(fetch_comment_items "$repo" "$pr"); then
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
