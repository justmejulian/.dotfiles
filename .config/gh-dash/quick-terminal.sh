#!/bin/zsh
# Run a command in Ghostty's Quick Terminal: quick-terminal.sh <command...>
# Errors are logged to ~/.config/gh-dash/quick-terminal.log (gh-dash hides stderr).
exec 2>>~/.config/gh-dash/quick-terminal.log
osascript - "$*" <<'EOF'
on run argv
  set cmd to item 1 of argv

  tell application "Ghostty"
    -- The quick terminal autohides when Ghostty loses focus, so if Ghostty isn't
    -- frontmost it's hidden. Only when Ghostty is frontmost do we need to ask
    -- System Events (requires Accessibility) whether it's already showing.
    set qtShown to false
    if frontmost then
      try
        tell application "System Events" to tell process "Ghostty"
          set qtShown to (count of (windows whose subrole is "AXFloatingWindow")) > 0
        end tell
      end try
    end if
    if not qtShown then
      perform action "toggle_quick_terminal" on terminal 1
      delay 0.3
    end if

    -- The quick terminal is the one surface that doesn't belong to a regular window
    set windowTerms to {}
    repeat with w in windows
      set windowTerms to windowTerms & (id of every terminal of w)
    end repeat
    repeat with t in terminals
      if windowTerms does not contain (id of t) then
        input text cmd to t
        send key "enter" to t
        return
      end if
    end repeat
  end tell
end run
EOF
