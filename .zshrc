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

eval "$(starship init zsh)"

autoload -U history-search-end
zle -N history-beginning-search-backward-end history-search-end
zle -N history-beginning-search-forward-end history-search-end
bindkey "^[[A" history-beginning-search-backward-end
bindkey "^[[B" history-beginning-search-forward-end

function brew() {
  local dump_commands=('install' 'uninstall') # Include all commands that should do a brew dump
  local main_command="${1}"

  /usr/local/bin/brew ${@}

  for command in "${dump_commands[@]}"; do
    [[ "${command}" == "${main_command}" ]] && /usr/local/bin/brew bundle dump --file="${HOME}/.Brewfile" --force
  done
}
