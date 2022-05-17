autoload -Uz compinit && compinit

export NVM_DIR="$HOME/.nvm"
[ -s "/usr/local/opt/nvm/nvm.sh" ] && . "/usr/local/opt/nvm/nvm.sh"  # This loads nvm
[ -s "/usr/local/opt/nvm/etc/bash_completion" ] && . "/usr/local/opt/nvm/etc/bash_completion"  # This loads nvm bash_completioneval "$(pyenv init -)"

export JAVA_HOME=`/usr/libexec/java_home -v 12.0.1`

export PATH="$HOME/.local/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

alias config='/usr/bin/git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME'

source $HOME/.zsh/aliases.zsh
source $HOME/.zsh/git.zsh
source $HOME/.zsh/autojump.zsh
source $HOME/.zsh/brew.zsh
source $HOME/.zsh/historysearch.zsh
source $HOME/.zsh/autoExpandAlias.zsh

eval "$(starship init zsh)"
