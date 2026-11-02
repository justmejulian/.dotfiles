# Sourced into a "serve" tab's zsh by run_serve_steps (lib.sh) with the repo
# name as $1. Runs that repo's serve.conf steps in order in this shell, stopping
# at the first one that fails, and adds each step to the shell history as its
# own entry, so up/enter reruns just the last step.
() {
  local repo=$1 conf=$2 step
  for step in "${(@f)$(sed -n "s/^[[:space:]]*${repo}[[:space:]]*=[[:space:]]*//p" "$conf")}"; do
    print -s -- "$step"
    eval "$step" || return
  done
} "$1" "${${(%):-%x}:A:h}/serve.conf"
