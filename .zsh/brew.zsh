function brew() {
  local main_command="${1}"

  /opt/homebrew/bin/brew ${@}
  local exit_status=$?

  if [[ $exit_status -eq 0 ]] && [[ "${main_command}" == "install" || "${main_command}" == "uninstall" ]]; then
    local brewfile="${HOME}/.Brewfile"
    local kind=""
    local arg line

    shift

    for arg in "${@}"; do
      [[ "${arg}" == "--cask" ]] && kind="cask"
      [[ "${arg}" == "--formula" ]] && kind="brew"
    done

    for arg in "${@}"; do
      [[ "${arg}" == -* ]] && continue

      if [[ "${main_command}" == "install" ]]; then
        # `brew install <name>` silently falls back to a cask when no formula
        # exists, so ask Homebrew what actually got installed.
        local entry_kind="${kind}"
        if [[ -z "${entry_kind}" ]]; then
          if /opt/homebrew/bin/brew list --cask "${arg}" &>/dev/null; then
            entry_kind="cask"
          else
            entry_kind="brew"
          fi
        fi
        line="${entry_kind} \"${arg}\""

        if [[ ! -f "${brewfile}" ]] || ! grep -qxF "${line}" "${brewfile}"; then
          echo "${line}" >> "${brewfile}"
          echo "Added ${line} to .Brewfile"
        fi
      else
        # The package is gone, so remove whichever entry type exists.
        for line in "brew \"${arg}\"" "cask \"${arg}\""; do
          if [[ -f "${brewfile}" ]] && grep -qxF "${line}" "${brewfile}"; then
            grep -vxF "${line}" "${brewfile}" > "${brewfile}.tmp" && mv "${brewfile}.tmp" "${brewfile}"
            echo "Removed ${line} from .Brewfile"
          fi
        done
      fi
    done
  fi
}

function _mas_brewfile_add() {
  local id="${1}" name="${2}"
  local brewfile="${HOME}/.Brewfile"
  local line="mas \"${name}\", id: ${id}"

  if [[ ! -f "${brewfile}" ]] || ! grep -qF "id: ${id}" "${brewfile}"; then
    echo "${line}" >> "${brewfile}"
    echo "Added ${line} to .Brewfile"
  fi
}

function mas() {
  local main_command="${1}"

  # `mas install <search terms>`: search, pick with fzf, install by id, record it.
  if [[ "${main_command}" == "install" ]] && [[ -n "${2}" ]]; then
    case "${2}" in
      (<->) ;; # numeric id, fall through to plain install below
      (*)
        shift
        local query="${*}"
        local selection id name

        selection=$(/opt/homebrew/bin/mas search "${query}" | fzf --prompt="Install> ")
        [[ -z "${selection}" ]] && return 1

        id="${${selection%%  *}// /}"
        name=$(echo "${selection}" | awk '{ $1 = ""; sub(/\([^)]*\)$/, ""); gsub(/^[ \t]+|[ \t]+$/, ""); print }')

        /opt/homebrew/bin/mas install "${id}"
        local exit_status=$?
        [[ $exit_status -ne 0 ]] && return $exit_status

        _mas_brewfile_add "${id}" "${name}"
        return 0
        ;;
    esac
  fi

  /opt/homebrew/bin/mas ${@}
  local exit_status=$?

  if [[ $exit_status -eq 0 ]] && [[ "${main_command}" == "install" || "${main_command}" == "uninstall" ]]; then
    local brewfile="${HOME}/.Brewfile"
    local id name

    shift

    for id in "${@}"; do
      [[ "${id}" == -* ]] && continue

      if [[ "${main_command}" == "install" ]]; then
        name=$(/opt/homebrew/bin/mas list | awk -v id="${id}" '$1 == id { $1 = ""; sub(/\([^)]*\)$/, ""); gsub(/^[ \t]+|[ \t]+$/, ""); print; exit }')
        [[ -n "${name}" ]] && _mas_brewfile_add "${id}" "${name}"
      else
        if [[ -f "${brewfile}" ]] && grep -qF "id: ${id}" "${brewfile}"; then
          grep -vF "id: ${id}" "${brewfile}" > "${brewfile}.tmp" && mv "${brewfile}.tmp" "${brewfile}"
          echo "Removed entry with id: ${id} from .Brewfile"
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
  echo 'Upgrading Mac App Store packages...'
  /opt/homebrew/bin/mas upgrade
  echo ' '
  echo 'Cleaning up Homebrew...'
  /opt/homebrew/bin/brew cleanup
  echo ' '
  echo 'Rebuilding Appify TUI apps...'
  ~/.scripts/appify-tui.sh --all
}
