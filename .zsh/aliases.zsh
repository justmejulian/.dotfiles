alias sz='source ~/.zshrc'

alias cat='bat'
alias ls='exa'
alias ll='exa -la'
alias lg='exa -la --git'
alias grep="grep --color='auto'"
alias z="zellij"
cdl () { cd "${@}" ; ls ;}

alias nd="nvim -c 'DiffviewOpen' ."
alias ndm="nvim -c 'DiffviewOpen origin/master' ."
