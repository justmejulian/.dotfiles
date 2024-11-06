alias sz='source ~/.zshrc'

alias cat='bat'
alias ls='eza'
alias ll='eza -la'
alias lg='eza -la --git'
alias grep="grep --color='auto'"
alias z="zellij"
cdl() { cd "${@}" ; ls ;}

alias nd="nvim -c 'DiffviewOpen' ."
alias ndm="nvim -c 'DiffviewOpen origin/master' ."

# edit project
ep() {
  foldername=$(basename $(pwd))
  inside_git_repo="$(git rev-parse --is-inside-work-tree 2>/dev/null)"

  if [ "$inside_git_repo" ]; then
    gitroot=$(basename $(git root) 2>/dev/null)

    if [ "$gitroot" ]; then
    else
      gitroot=$(basename $(git rev-parse --show-toplevel))
    fi


    if [[ $foldername == $gitroot ]]; then
      kitten @ set-tab-title $foldername
      nvim .
    else
      kitten @ set-tab-title $gitroot - $foldername
      nvim .
    fi
  else
    kitten @ set-tab-title $foldername
    nvim .
  fi
}
