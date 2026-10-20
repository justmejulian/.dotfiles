#!/usr/bin/env bash
# PR review tab, right top: GitHub checks for the PR, refreshed every 5 minutes.
# New failures on the PR's head commit are sent to pi once.
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

  new=""
  while IFS=$'\t' read -r name link; do
    [ -n "$name" ] || continue
    grep -qxF "$sha"$'\t'"$name" "$notified" || new+="- $name: $link"$'\n'
  done <<<"$failed"

  if [ -n "$new" ]; then
    msg="CI failed on PR #$pr ($repo, commit ${sha:0:7}):
$new
Check the failures, for example with \`gh run view <run-id> -R $repo --log-failed\`. If this PR caused them, fix them. Don't push until I confirm."
    if ask_pi "$pi" "$msg"; then
      while IFS=$'\t' read -r name _; do
        [ -n "$name" ] && printf '%s\t%s\n' "$sha" "$name" >>"$notified"
      done <<<"$failed"
      echo; echo "→ sent new failures to pi"
    else
      echo; echo "! couldn't reach pi ($pi), retrying next check"
    fi
  fi

  wait_refresh
done
