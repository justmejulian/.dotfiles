autoload -Uz compinit && compinit

# For Autojump
[ -f /usr/local/etc/profile.d/autojump.sh ] && . /usr/local/etc/profile.d/autojump.sh

# NVM
export NVM_DIR="$HOME/.nvm"
[ -s "/usr/local/opt/nvm/nvm.sh" ] && . "/usr/local/opt/nvm/nvm.sh"  # This loads nvm
[ -s "/usr/local/opt/nvm/etc/bash_completion" ] && . "/usr/local/opt/nvm/etc/bash_completion"  # This loads nvm bash_completioneval "$(pyenv init -)"

# Java
export JAVA_HOME=`/usr/libexec/java_home -v 12.0.1`

# expand on space
function expand-alias() {
  zle _expand_alias
  zle self-insert
}
autoload expand-alias
zle -N expand-alias
bindkey -M main ' ' expand-alias

alias config='/usr/bin/git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME'
