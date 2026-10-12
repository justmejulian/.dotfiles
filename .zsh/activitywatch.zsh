# Log every shell command to ActivityWatch (bucket aw-watcher-shell_$HOST).
# Each event spans the command's runtime: command, cwd, git repo, branch, exit code.

zmodload zsh/datetime

typeset -g _aw_shell_api='http://127.0.0.1:5600/api/0'
typeset -g _aw_shell_bucket="aw-watcher-shell_$HOST"
typeset -g _aw_shell_cmd _aw_shell_cwd _aw_shell_start

_aw_shell_json() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\t'/\\t}
  s=${s//$'\r'/\\r}
  print -rn -- "\"$s\""
}

_aw_shell_preexec() {
  _aw_shell_cmd=$1
  _aw_shell_cwd=$PWD
  _aw_shell_start=$EPOCHREALTIME
}

_aw_shell_precmd() {
  local exit_code=$?
  [[ -z $_aw_shell_cmd ]] && return
  local cmd=$_aw_shell_cmd cwd=$_aw_shell_cwd start=$_aw_shell_start
  _aw_shell_cmd=
  (
    local repo branch
    repo=$(git -C $cwd rev-parse --show-toplevel 2>/dev/null)
    [[ -n $repo ]] && branch=$(git -C $cwd branch --show-current 2>/dev/null)
    local timestamp=$(TZ=UTC strftime '%Y-%m-%dT%H:%M:%S' ${start%.*}).${${start#*.}[1,6]}+00:00
    local duration=$(( EPOCHREALTIME - start ))
    local event="{\"timestamp\":\"$timestamp\",\"duration\":$duration,\"data\":{\
\"command\":$(_aw_shell_json $cmd),\"cwd\":$(_aw_shell_json $cwd),\
\"repo\":$(_aw_shell_json ${repo:t}),\"branch\":$(_aw_shell_json $branch),\
\"exit_code\":$exit_code}}"
    curl -s -m 2 -o /dev/null -X POST -H 'Content-Type: application/json' \
      -d '{"client":"zsh","type":"shell.command","hostname":"'$HOST'"}' \
      $_aw_shell_api/buckets/$_aw_shell_bucket
    curl -s -m 2 -o /dev/null -X POST -H 'Content-Type: application/json' \
      -d $event $_aw_shell_api/buckets/$_aw_shell_bucket/events
  ) &>/dev/null &!
}

autoload -Uz add-zsh-hook
add-zsh-hook preexec _aw_shell_preexec
add-zsh-hook precmd _aw_shell_precmd
