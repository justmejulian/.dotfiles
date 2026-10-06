#!/bin/sh
# Package a TUI as a standalone fullscreen macOS app with Appify.
#
# Usage: appify-tui.sh <slug>...
#        appify-tui.sh --all
#
# Each app is described by ~/.config/appify/<slug>.conf, a sourced shell file:
#
#   name="GitHub Dashboard"   # required, app name
#   binary="gh"               # required, resolved via command -v + realpath
#   args="dash"               # optional, arguments passed to binary
#   requires="gh jq"          # optional, space-separated extra commands to check
#   bundle_id="dev.x.app"     # optional, default dev.<slug>.app
#   width=1200 height=800     # optional
#   setup() { ...; }          # optional, runs before the build
#   post_install() { ...; }   # optional, runs after the install
#
# Optional per-app files:
#   ~/.assets/<slug>/AppIcon.icns        custom icon (Appify's default otherwise)
#   ~/.config/appify/<slug>.ghostty      Ghostty config (default.ghostty otherwise)

set -eu

config_dir="$HOME/.config/appify"
assets_dir="$HOME/.assets"
app_dir="$HOME/Applications"

usage() {
  echo "Usage: $(basename "$0") <slug>... | --all" >&2
  echo "Available apps:" >&2
  list_slugs | sed 's/^/  /' >&2
  exit 1
}

list_slugs() {
  for conf in "$config_dir"/*.conf; do
    [ -f "$conf" ] && basename "$conf" .conf
  done
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    echo "Run: brew bundle install --file ~/.Brewfile" >&2
    exit 1
  fi
}

require_file() {
  if [ ! -f "$1" ]; then
    echo "Missing required file: $1" >&2
    exit 1
  fi
}

install_app() (
  slug=$1
  conf="$config_dir/$slug.conf"
  require_file "$conf"

  name="" binary="" args="" requires=""
  bundle_id="dev.$slug.app" width=1200 height=800
  setup() { :; }
  post_install() { :; }
  # shellcheck source=/dev/null
  . "$conf"

  if [ -z "$name" ] || [ -z "$binary" ]; then
    echo "$conf must set name and binary" >&2
    exit 1
  fi

  destination="$app_dir/$name.app"
  icon="$assets_dir/$slug/AppIcon.icns"
  ghostty_config="$config_dir/$slug.ghostty"
  [ -f "$ghostty_config" ] || ghostty_config="$config_dir/default.ghostty"
  require_file "$ghostty_config"

  # $requires is intentionally unquoted so it splits into words.
  for cmd in "$binary" appify codesign $requires; do
    require_command "$cmd"
  done

  setup

  binary_path=$(command -v "$binary")
  if command -v realpath >/dev/null 2>&1; then
    binary_path=$(realpath "$binary_path")
  fi

  tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/appify-tui-$slug.XXXXXX")
  backup=""

  cleanup() {
    if [ -n "$backup" ] && [ -d "$backup" ] && [ ! -e "$destination" ]; then
      mv "$backup" "$destination"
    fi
    rm -rf "$tmp_dir"
  }
  trap cleanup EXIT HUP INT TERM

  echo "Building $name.app with $binary_path $args..."
  # $args is intentionally unquoted so it splits into words.
  appify \
    --name "$name" \
    --bundle-id "$bundle_id" \
    --output "$tmp_dir" \
    --width "$width" \
    --height "$height" \
    --ghostty-config "$ghostty_config" \
    -- "$binary_path" $args

  built_app="$tmp_dir/$name.app"
  resources="$built_app/Contents/Resources"
  plist="$built_app/Contents/Info.plist"

  if [ -f "$icon" ]; then
    # Appify's PNG-to-ICNS conversion is unreliable. Copy the finished ICNS file
    # directly and register it in the application bundle instead.
    cp "$icon" "$resources/AppIcon.icns"
    /usr/libexec/PlistBuddy -c 'Delete :CFBundleIconFile' "$plist" >/dev/null 2>&1 || true
    /usr/libexec/PlistBuddy -c 'Add :CFBundleIconFile string AppIcon.icns' "$plist"
    # Customizing the bundle invalidates Appify's original signature.
    rm -rf "$built_app/Contents/_CodeSignature"
  else
    echo "No custom icon found at $icon, using Appify's default." >&2
  fi

  codesign --force --deep --sign - "$built_app"
  codesign --verify --deep --strict "$built_app"

  mkdir -p "$app_dir"
  if [ -e "$destination" ]; then
    backup="$tmp_dir/$name.previous.app"
    mv "$destination" "$backup"
  fi
  mv "$built_app" "$destination"
  backup=""

  # Refresh Launch Services so Finder and Spotlight pick up the app and icon.
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
    -f "$destination" >/dev/null 2>&1 || true
  touch "$destination"

  echo "Installed $destination"
  post_install
)

[ $# -gt 0 ] || usage

if [ "$1" = "--all" ]; then
  # Rebuild each app in its own process so one failure doesn't stop the rest
  # (set -e is ignored inside a function called from an || list).
  failed=""
  for slug in $(list_slugs); do
    "$0" "$slug" || failed="$failed $slug"
  done
  if [ -n "$failed" ]; then
    echo "Failed to build:$failed" >&2
    exit 1
  fi
  exit 0
fi

for slug in "$@"; do
  install_app "$slug"
done
