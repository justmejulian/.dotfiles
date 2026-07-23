#!/bin/bash
#
# Install the "U.S. with German Umlauts" keyboard layout and make it the ONLY
# enabled keyboard layout — no manual plist editing / System Settings clicking.
#
#   option + a/o/u/s => ä ö ü ß   |   option + e => €
#
# Source: https://github.com/patrick-zippenfenig/us-with-german-umlauts

set -euo pipefail

# 1. Install the layout bundle for all users (needs sudo).
curl -sL https://api.github.com/repos/patrick-zippenfenig/us-with-german-umlauts/tarball/master \
  | sudo tar xz --exclude=README.md --strip=1 -C "/Library/Keyboard Layouts/"

# 2. Configure com.apple.HIToolbox via `defaults` (this replaces the old
#    manual step of editing com.apple.HIToolbox.plist by hand).
#    ID/Name come from the <keyboard> element in the .keylayout file.
#
#    NB: the value is written as XML so "KeyboardLayout ID" is a real <integer>.
#    Old-style `{ ... = -17743; }` dicts store it as a STRING, which macOS does
#    not match — the layout then silently never activates.
LAYOUT='<dict>
    <key>InputSourceKind</key><string>Keyboard Layout</string>
    <key>KeyboardLayout ID</key><integer>-17743</integer>
    <key>KeyboardLayout Name</key><string>U.S. with German Umlauts</string>
  </dict>'

# Only this layout is enabled; keep the two non-keyboard input methods
# (emoji/symbol picker + accent press-and-hold).
defaults write com.apple.HIToolbox AppleEnabledInputSources "<array>
  $LAYOUT
  <dict><key>Bundle ID</key><string>com.apple.CharacterPaletteIM</string><key>InputSourceKind</key><string>Non Keyboard Input Method</string></dict>
  <dict><key>Bundle ID</key><string>com.apple.PressAndHold</string><key>InputSourceKind</key><string>Non Keyboard Input Method</string></dict>
</array>"

# Make it the selected/active layout.
defaults write com.apple.HIToolbox AppleSelectedInputSources "<array>
  $LAYOUT
</array>"

# Set it as the current keyboard layout (TISInputSourceID from the bundle's
# Info.plist; the double dot is literal). Otherwise this key is left pointing
# at the previous, now-disabled layout.
defaults write com.apple.HIToolbox AppleCurrentKeyboardLayoutInputSourceID \
  -string "org.sil.ukelele.keyboardlayout..u.s.withgermanumlauts"

echo "Done. Log out and back in (or restart) for the input source to take effect."
