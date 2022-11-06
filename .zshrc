# Enable vi mode
bindkey -v

autoload -Uz compinit
compinit

zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'

source $HOME/.zsh/aliases.zsh
source $HOME/.zsh/config.zsh
source $HOME/.zsh/git.zsh
source $HOME/.zsh/autojump.zsh
source $HOME/.zsh/brew.zsh
source $HOME/.zsh/pyenv.zsh
source $HOME/.zsh/nvm.zsh
source $HOME/.zsh/historysearch.zsh
source $HOME/.zsh/autoExpandAlias.zsh
source $HOME/.zsh/exports.zsh

source $HOME/.zsh/catppuccin-zsh-syntax-highlighting/catppuccin-zsh-syntax-highlighting.zsh #must load before zsh-syntax-highlighting
source $HOME/.zsh/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
source $HOME/.zsh/zsh-vi-mode/zsh-vi-mode.plugin.zsh

eval "$(starship init zsh)"
