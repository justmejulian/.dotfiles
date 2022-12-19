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
alias gl='git pull'

alias gs='git status'

alias gsta='git stash apply'
alias gstc='git stash clear'
alias gstl='git stash list'
alias gstp='git stash pop'

# worktree
alias gw='git worktree'
alias gwl='git worktree list'
alias gwp='git worktree prune'
alias gwr='git worktree remove'
alias gwa='(){ git worktree add $1 $1;}'

gfd() {
  preview="git diff $@ --color=always -- {-1}"
  git diff $@ --name-only | fzf -m --ansi --preview $preview
}

# Config -> dotfiles bare repo
alias config='git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME'
alias c='config'
alias cs='config status'
alias cc='config commit'
alias ca='config add'
alias cap='config add --patch'
alias clu="config status -u ." # list untracked files in current folder
alias cus="config submodule update --remote"
