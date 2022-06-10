autoload -Uz compinit && compinit

source $HOME/.zsh/aliases.zsh
source $HOME/.zsh/git.zsh
source $HOME/.zsh/autojump.zsh
source $HOME/.zsh/brew.zsh
source $HOME/.zsh/historysearch.zsh
source $HOME/.zsh/autoExpandAlias.zsh
source $HOME/.zsh/exports.zsh
source $HOME/.zsh/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

eval "$(starship init zsh)"

source <(kubectl completion zsh)
