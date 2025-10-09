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

alias bu='homebrew_update_all'

function homebrew_update_all() {
  echo ' '
  echo 'Updating Homebrew...'
  /opt/homebrew/bin/brew update
  echo ' '
  echo 'Upgrading Homebrew packages...'
  /opt/homebrew/bin/brew upgrade
  echo ' '
  echo 'Upgrading Homebrew casks packages...'
  /opt/homebrew/bin/brew upgrade --cask $(brew list --cask)
  echo ' '
  echo 'Cleaning up Homebrew...'
  /opt/homebrew/bin/brew cleanup
}
