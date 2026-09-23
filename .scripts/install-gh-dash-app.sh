#!/bin/sh

set -eu

app_name="GitHub Dashboard"
bundle_id="dev.gh-dash.app"
app_dir="$HOME/Applications"
destination="$app_dir/$app_name.app"
icon="$HOME/.assets/gh-dash/AppIcon.icns"
ghostty_config="$HOME/.config/appify/gh-dash.ghostty"

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

require_command gh
require_command appify
require_command codesign
require_file "$icon"
require_file "$ghostty_config"

if ! gh extension list | grep -Eq '(^|[[:space:]])dlvhdr/gh-dash([[:space:]]|$)'; then
  echo "Installing gh-dash extension..."
  gh extension install dlvhdr/gh-dash
fi

gh_path=$(command -v gh)
if command -v realpath >/dev/null 2>&1; then
  gh_path=$(realpath "$gh_path")
fi

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/install-gh-dash-app.XXXXXX")
backup=""

cleanup() {
  if [ -n "$backup" ] && [ -d "$backup" ] && [ ! -e "$destination" ]; then
    mv "$backup" "$destination"
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT HUP INT TERM

echo "Building $app_name.app with $gh_path..."
appify \
  --name "$app_name" \
  --bundle-id "$bundle_id" \
  --output "$tmp_dir" \
  --width 1200 \
  --height 800 \
  --ghostty-config "$ghostty_config" \
  -- "$gh_path" dash

built_app="$tmp_dir/$app_name.app"
resources="$built_app/Contents/Resources"
plist="$built_app/Contents/Info.plist"

# Appify's PNG-to-ICNS conversion is unreliable. Copy the finished ICNS file
# directly and register it in the application bundle instead.
cp "$icon" "$resources/AppIcon.icns"
/usr/libexec/PlistBuddy -c 'Delete :CFBundleIconFile' "$plist" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c 'Add :CFBundleIconFile string AppIcon.icns' "$plist"

# Customizing the bundle invalidates Appify's original signature.
rm -rf "$built_app/Contents/_CodeSignature"
codesign --force --deep --sign - "$built_app"
codesign --verify --deep --strict "$built_app"

mkdir -p "$app_dir"
if [ -e "$destination" ]; then
  backup="$tmp_dir/$app_name.previous.app"
  mv "$destination" "$backup"
fi
mv "$built_app" "$destination"
backup=""

# Refresh Launch Services so Finder and Spotlight pick up the app and icon.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "$destination" >/dev/null 2>&1 || true
touch "$destination"

echo "Installed $destination"
if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
fi
