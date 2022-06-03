autoload -Uz compinit && compinit

source $HOME/.zsh/aliases.zsh
source $HOME/.zsh/git.zsh
source $HOME/.zsh/autojump.zsh
source $HOME/.zsh/brew.zsh
source $HOME/.zsh/historysearch.zsh
source $HOME/.zsh/autoExpandAlias.zsh
source $HOME/.zsh/exports.zsh

eval "$(starship init zsh)"
