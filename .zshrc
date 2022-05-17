autoload -Uz compinit && compinit

alias config='/usr/bin/git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME'

source $HOME/.zsh/aliases.zsh
source $HOME/.zsh/git.zsh
source $HOME/.zsh/autojump.zsh
source $HOME/.zsh/brew.zsh
source $HOME/.zsh/historysearch.zsh
source $HOME/.zsh/autoExpandAlias.zsh
source $HOME/.zsh/exports.zsh

eval "$(starship init zsh)"
