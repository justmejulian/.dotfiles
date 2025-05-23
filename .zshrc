# Enable vi mode
bindkey -v

fpath=($HOMEBREW_PREFIX/share/zsh-completions $fpath)

# https://docs.brew.sh/Shell-Completion#configuring-completions-in-zsh
fpath=($HOMEBREW_PREFIX/share/zsh/site-functions $fpath)
autoload -Uz compinit
compinit
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'

source $HOME/.zsh/aliases.zsh
source $HOME/.zsh/git.zsh
source $HOME/.zsh/brew.zsh
source $HOME/.zsh/pyenv.zsh
source $HOME/.zsh/nvm.zsh
source $HOME/.zsh/historysearch.zsh
source $HOME/.zsh/autoExpandAlias.zsh
source $HOME/.zsh/exports.zsh
source $HOME/.zsh/catppuccin-zsh-syntax-highlighting/themes/catppuccin_mocha-zsh-syntax-highlighting.zsh
source $HOME/.zsh/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
source $HOME/.zsh/zsh-vi-mode/zsh-vi-mode.plugin.zsh
source $HOME/.zsh/git-worktree/main.zsh

command -v ghcup >/dev/null || export PATH="$HOME/.ghcup/bin:$PATH"

eval "$(starship init zsh)"
eval "$(zoxide init zsh)"

