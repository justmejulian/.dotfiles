#!/usr/bin/env bash
# PR review tab, right top: GitHub checks for the PR, refreshed every 5 minutes.
# New failures on the PR's head commit are queued once and handed to an
# address-feedback run (see launch_pending in lib.sh).
#
#   ci-watch.sh <owner/repo> <number> <pi-pane>
set -uo pipefail
source "$(dirname "$0")/lib.sh"

repo=$1 pr=$2 pi=$3
notified="$(state_dir "$repo" "$pr")/ci-notified" # lines: <sha>\t<check name>
touch "$notified"

while :; do
  clear
  echo "CI · $repo#$pr · $(date +%H:%M)"
  echo

  if ! pr_open "$repo" "$pr"; then
    echo "PR is no longer open, stopped watching."
    exit 0
  fi

  sha=$(gh pr view "$pr" -R "$repo" --json headRefOid -q .headRefOid)
  checks=$(gh pr checks "$pr" -R "$repo" --json name,bucket,link \
    --jq '.[] | [.bucket, .name, .link] | @tsv' 2>/dev/null)

  if [ -z "$checks" ]; then
    echo "no checks yet for ${sha:0:7}"
    wait_refresh
    continue
  fi

  total=$(grep -c . <<<"$checks")
  passed=$(grep -c $'^pass\t\|^skipping\t' <<<"$checks")
  pending=$(grep -c $'^pending\t' <<<"$checks")
  failed=$(grep $'^fail\t\|^cancel\t' <<<"$checks" | cut -f2- | sort -u)

  echo "${sha:0:7}  ✓ $passed  ◔ $pending  ✗ $(grep -c . <<<"$failed")  of $total"
  if [ -n "$failed" ]; then
    echo
    while IFS=$'\t' read -r name link; do echo "✗ $name"; echo "  $link"; done <<<"$failed"
  fi
  if [ "$pending" -gt 0 ]; then
    echo
    grep $'^pending\t' <<<"$checks" | cut -f2 | sed 's/^/◔ /'
  fi

  # New failures go into the PR's pending batch; launch_pending starts one
  # address-feedback run with everything queued (comments included).
  items=""
  while IFS=$'\t' read -r name link; do
    [ -n "$name" ] || continue
    grep -qxF "$sha"$'\t'"$name" "$notified" && continue
    items+=$(jq -cn --arg key "ci:$sha:$name" --arg where "$name" --arg url "$link" --arg body "failed on ${sha:0:7}" \
      '{key: $key, kind: "ci", where: $where, url: $url, body: $body}')$'\n'
    printf '%s\t%s\n' "$sha" "$name" >>"$notified"
  done <<<"$failed"
  if [ -n "$items" ]; then
    queue_items "$repo" "$pr" "$items"
    echo; echo "+ queued $(grep -c . <<<"$items") new failure(s)"
  fi
  echo; launch_pending "$repo" "$pr" "$pi"

  wait_refresh
done
