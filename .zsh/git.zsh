alias g='git'

alias ga='git add'
alias gaa='git add --all'
alias gap='git add --patch'

alias gb='git branch'

alias gc='git commit -v'
alias gca='git commit -v --amend'

alias gco='git checkout'

alias gd='git diff'

alias gp='git push'

alias gs='git status'

alias gsta='git stash apply'
alias gstc='git stash clear'
alias gstl='git stash list'
alias gstp='git stash pop'

# Config -> dotfiles bare repo
alias config='/usr/bin/git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME'
alias c='config'
alias cp='config push'
alias cs='config status'
alias cc='config commit'
alias ca='config add'
alias cap='config add --patch'
