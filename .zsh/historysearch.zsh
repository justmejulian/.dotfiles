autoload -U history-search-end
zle -N history-beginning-search-backward-end history-search-end
zle -N history-beginning-search-forward-end history-search-end
bindkey "^[[A" history-beginning-search-backward-end
bindkey "^[[B" history-beginning-search-forward-end
# For Control k and j
bindkey '^k' history-beginning-search-backward-end
bindkey '^j' history-beginning-search-forward-end

# atuin but only for ctrl-r
export ATUIN_NOBIND="true"
eval "$(atuin init zsh)"
bindkey '^h' atuin-search
