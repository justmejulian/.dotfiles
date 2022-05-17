# expand on space
function expand-alias() {
  zle _expand_alias
  zle self-insert
}

autoload expand-alias
zle -N expand-alias
bindkey -M main ' ' expand-alias
