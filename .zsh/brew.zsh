function brew() {

  local dump_commands=('install' 'uninstall') # Include all commands that should do a brew dump
  local main_command="${1}"

  /opt/homebrew/bin/brew ${@}

  for command in "${dump_commands[@]}"; do
    if [[ "${command}" == "${main_command}" ]]
    then
	    echo ' '
      echo 'Updating .Brewfile'
      /opt/homebrew/bin/brew bundle dump --file="${HOME}/.Brewfile" --force
    fi
  done
}
