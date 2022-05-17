export NVM_DIR="$HOME/.nvm"
[ -s "/usr/local/opt/nvm/nvm.sh" ] && . "/usr/local/opt/nvm/nvm.sh"  # This loads nvm
[ -s "/usr/local/opt/nvm/etc/bash_completion" ] && . "/usr/local/opt/nvm/etc/bash_completion"  # This loads nvm bash_completioneval "$(pyenv init -)"

export JAVA_HOME=`/usr/libexec/java_home -v 12.0.1`

path=("$HOME/.local/bin" "/usr/local/bin" $path)
