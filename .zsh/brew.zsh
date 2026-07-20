function brew() {
  local main_command="${1}"

  /opt/homebrew/bin/brew ${@}
  local exit_status=$?

  if [[ $exit_status -eq 0 ]] && [[ "${main_command}" == "install" || "${main_command}" == "uninstall" ]]; then
    local brewfile="${HOME}/.Brewfile"
    local is_cask=false
    local arg line

    shift

    for arg in "${@}"; do
      [[ "${arg}" == "--cask" ]] && is_cask=true
    done

    for arg in "${@}"; do
      [[ "${arg}" == -* ]] && continue

      if [[ "${is_cask}" == true ]]; then
        line="cask \"${arg}\""
      else
        line="brew \"${arg}\""
      fi

      if [[ "${main_command}" == "install" ]]; then
        if [[ ! -f "${brewfile}" ]] || ! grep -qxF "${line}" "${brewfile}"; then
          echo "${line}" >> "${brewfile}"
          echo "Added ${line} to .Brewfile"
        fi
      else
        if [[ -f "${brewfile}" ]] && grep -qxF "${line}" "${brewfile}"; then
          grep -vxF "${line}" "${brewfile}" > "${brewfile}.tmp" && mv "${brewfile}.tmp" "${brewfile}"
          echo "Removed ${line} from .Brewfile"
        fi
      fi
    done
  fi
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
