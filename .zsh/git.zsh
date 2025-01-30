alias g='git'

alias ga='git add'
alias gaa='git add --all'
alias gap='git add --patch'

alias gb='git branch'

alias gc='git commit -v'
alias gca='git commit -v --amend'
alias gcf='git commit -v --fixup='

alias gco='git checkout'

alias gd='git diff'

alias gp='git push'
alias gpf='git push --force-with-lease'

alias gl='git pull'
alias glm='git pull origin master'

alias gs='git status'
alias glg='git log --oneline -n 10'
alias glgs='git log --oneline --stat -n 10'
alias glgd='git log --oneline --stat -p'

alias gst='git stash'
alias gsta='git stash apply'
alias gstc='git stash clear'
alias gstl='git stash list'
alias gstp='git stash pop'

alias gr="git rebase -i --autosquash master"
alias grc="git rebase --continue"

# list zombie branches
alias glz=$'git fetch && git remote prune origin && git branch -vv | grep \': gone]\' | awk \'{ if ($1 !="+") print $1; else print $2; }\''

# worktree
alias gw='git worktree'
alias gwc='gwt clone'
alias gwl='git worktree list'
alias gws='gwt switch'
alias gwr='gwt remove'
alias gwa='gwt checkout -b'
alias gwco='gwt checkout'
alias gwrz=$'glz | xargs -I % zsh -c \'source $HOME/.zsh/git-worktree/main.zsh; gwt remove %;\''

# Config -> dotfiles bare repo
alias config='git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME'
alias c='config'
alias cs='config status'
alias cc='config commit'
alias ca='config add'
alias cca='config commit -v --amend'
alias cap='config add --patch'
alias clu="config status -u ." # list untracked files in current folder
alias cus="config submodule update --remote"
