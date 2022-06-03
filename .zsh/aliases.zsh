alias cat='bat'
alias ls='exa'
alias la='exa -la'
alias grep="grep --color='auto'"
alias mkcd="mkdir -p && cd $_"
cdl () { cd "${@}" ; ls ;}
