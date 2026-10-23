#!/usr/bin/env bash
# ci-watch.sh <owner/repo> <number> <pi-pane>
set -uo pipefail
source "$(dirname "$0")/lib.sh"

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <owner/repo> <number> <pi-pane>" >&2
  exit 2
fi
repo=$1 pr=$2 pi_pane=$3
dir=$(state_dir "$repo" "$pr") || exit 1
lock="$dir/ci-watch.lock"
if ! mkdir "$lock" 2>/dev/null; then
  echo "! CI watcher already locked: $lock (not stealing; reconcile stale locks manually)" >&2
  exit 1
fi
trap 'rm -f "$lock/pid"; rmdir "$lock" 2>/dev/null || true' EXIT
trap 'echo "! CI watch cancelled (INT); no completion sent" >&2; exit 130' INT
trap 'echo "! CI watch cancelled (TERM); no completion sent" >&2; exit 143' TERM
printf '%s\n' "$$" >"$lock/pid" || exit 1

head_sha() {
  local value
  value=$(gh pr view "$pr" --repo "$repo" --json headRefOid -q .headRefOid) || return 1
  [[ "$value" =~ ^[0-9a-fA-F]{40}$ ]] || return 1
  printf '%s' "$value"
}

watch_once() {
  local cycle sha current watch_rc summary_rc raw checks digest key item counts failed outcome expected_rc
  local results marker notice
  results="$dir/ci-results"
  mkdir -p "$results" || return 1
  for cycle in 1 2 3 4 5; do
    sha=$(head_sha) || { echo "! cannot read PR head; no completion sent" >&2; return 1; }
    gh pr checks "$pr" --repo "$repo" --watch --interval 30
    watch_rc=$?
    case "$watch_rc" in
      130|143) echo "! native CI watch cancelled; no completion sent" >&2; return "$watch_rc" ;;
    esac
    current=$(head_sha) || { echo "! cannot validate PR head after watch" >&2; return 1; }
    if [ "$sha" != "$current" ]; then
      echo "↻ PR head changed during watch; discarding old result"
      continue
    fi
    case "$watch_rc" in
      0|1) ;;
      *) echo "! native CI watch error (exit $watch_rc); no completion sent" >&2; return 1 ;;
    esac
    raw=$(gh pr checks "$pr" --repo "$repo" --json name,bucket,state,link,startedAt,completedAt,workflow,event)
    summary_rc=$?
    current=$(head_sha) || { echo "! cannot validate PR head after summary" >&2; return 1; }
    if [ "$sha" != "$current" ]; then
      echo "↻ PR head changed during final summary; discarding old result"
      continue
    fi
    case "$summary_rc" in
      0|1|8) ;;
      *) echo "! final checks API error (exit $summary_rc); no completion sent" >&2; return 1 ;;
    esac
    checks=$(jq -sceS '
      if length != 1 then error("expected one JSON value") else .[0] end
      | if type != "array" then error("expected checks array") else . end
      | if all(.[]; type == "object"
          and (.name | type == "string" and length > 0)
          and (.state | type == "string" and length > 0)
          and (.bucket | IN("pass", "fail", "pending", "skipping", "cancel"))
          and (.link | type == "string")
          and ([.startedAt, .completedAt, .workflow, .event] | all(. == null or type == "string")))
        then map({name, bucket, state, link, startedAt, completedAt, workflow, event})
          | sort_by([.name, .workflow, .link, .startedAt, .completedAt, .state, .bucket, .event])
        else error("invalid check fields") end' <<<"$raw") || {
      echo "! malformed final checks JSON; no completion sent" >&2; return 1;
    }
    if [ "$(jq length <<<"$checks")" -eq 0 ]; then
      echo "! no checks yet; no completion sent" >&2; return 1
    fi
    if jq -e 'any(.[]; .bucket == "cancel" or (.state | IN("CANCELLED", "CANCELED")))' <<<"$checks" >/dev/null; then
      echo "! checks cancelled; no completion sent" >&2; return 1
    fi
    if jq -e 'any(.[]; .bucket == "pending")' <<<"$checks" >/dev/null; then
      echo "! checks still pending; no completion sent" >&2; return 1
    fi
    if ! jq -e 'all(.[];
        (.bucket == "pass" and (.state | IN("SUCCESS", "NEUTRAL"))) or
        (.bucket == "skipping" and .state == "SKIPPED") or
        (.bucket == "fail" and (.state | IN("FAILURE", "ERROR", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE", "STALE"))))' <<<"$checks" >/dev/null; then
      echo "! inconsistent final check states; no completion sent" >&2; return 1
    fi
    counts=$(jq -c '{total:length, passed:([.[] | select(.bucket == "pass")]|length),
      failed:([.[] | select(.bucket == "fail")]|length), skipped:([.[] | select(.bucket == "skipping")]|length)}' <<<"$checks") || return 1
    failed=$(jq -c '[.[] | select(.bucket == "fail") | {name, url:.link, state, workflow}]' <<<"$checks") || return 1
    outcome=pass expected_rc=0
    if [ "$(jq .failed <<<"$counts")" -gt 0 ]; then outcome=fail; expected_rc=1; fi
    if [ "$summary_rc" -ne "$expected_rc" ] || [ "$watch_rc" -ne "$expected_rc" ]; then
      echo "! watch/summary exit status disagrees with final checks; no completion sent" >&2; return 1
    fi
    digest=$(printf '%s' "$checks" | shasum -a 256) || return 1
    digest=${digest%% *}
    key="ci-completion:$sha:$digest"
    marker="$results/$sha-$digest.queued"
    notice="$results/$sha-$digest.notice-attempted"
    item=$(jq -cn --arg key "$key" --arg repo "$repo" --argjson pr "$pr" --arg sha "$sha" \
      --arg outcome "$outcome" --argjson counts "$counts" --argjson failed "$failed" \
      --argjson checks "$checks" --arg url "https://github.com/$repo/pull/$pr" '
      {key:$key, kind:"ci", repo:$repo, pr:$pr, sha:$sha, outcome:$outcome,
       counts:$counts, failed:$failed, checks:$checks, where:"CI completion", url:$url,
       body:("CI " + $outcome + " on " + $sha + "; " + ($counts|tojson))}') || return 1
    current=$(head_sha) || { echo "! cannot validate PR head before enqueue" >&2; return 1; }
    if [ "$sha" != "$current" ]; then
      echo "↻ PR head changed before enqueue; discarding old result"
      continue
    fi
    if [ ! -f "$marker" ]; then
      if ! feedback_was_queued "$repo" "$pr" "$key"; then
        queue_items "$repo" "$pr" "$item" || return 1
      fi
      printf '%s\n' "$key" >"$marker" || return 1
      echo "→ queued CI $outcome for $repo#$pr at $sha ($counts)"
    else
      echo "CI result already queued for $repo#$pr at $sha"
    fi
    if [ ! -f "$notice" ]; then
      : >"$notice" || return 1
      "$herdr" notification show "CI $outcome · $repo#$pr" \
        --body "$sha · $counts · https://github.com/$repo/pull/$pr" >/dev/null || \
        echo "! notification attempt failed; not automatically resending" >&2
    fi
    return 0
  done
  echo "! PR head kept changing; reopen to watch current head" >&2
  return 1
}

watch_once
result=$?
deliver_pending_feedback "$repo" "$pr" "$pi_pane" || { [ "$result" -ne 0 ] || result=1; }
exit "$result"
