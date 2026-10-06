# appify

Manifests for packaging terminal (TUI) programs as standalone fullscreen macOS
apps with [Appify](https://github.com/mattrobenolt/appify). Each app is a
Ghostty window that runs one command, with its own name, Dock icon and
Spotlight entry.

The apps are built by `~/.scripts/appify-tui.sh` and installed into
`~/Applications`.

## Usage

```sh
~/.scripts/appify-tui.sh gh-dash          # build one app
~/.scripts/appify-tui.sh gh-dash abtop    # build several
~/.scripts/appify-tui.sh --all            # rebuild every app in this directory
```

`homebrew_update_all` (`bu`) runs `--all` after upgrading, because each app
points at the real (versioned) path of its binary, which changes on upgrade.

## Files

| File | Purpose |
| --- | --- |
| `<slug>.conf` | Manifest for one app (required) |
| `<slug>.ghostty` | Ghostty config for one app (optional) |
| `default.ghostty` | Ghostty config used when an app has no `<slug>.ghostty` |
| `~/.assets/<slug>/AppIcon.icns` | Custom icon (optional, Appify's default otherwise) |

The slug is the manifest's file name without `.conf`.

## Manifest

A manifest is a shell file that the build script sources:

```sh
name="GitHub Dashboard"   # required: app name, installs ~/Applications/<name>.app
binary="gh"               # required: command to run, resolved via command -v + realpath
args="dash"               # optional: arguments passed to binary
requires="gh jq"          # optional: space-separated extra commands that must exist
bundle_id="dev.x.app"     # optional: default dev.<slug>.app
width=1200                # optional: default 1200
height=800                # optional: default 800

setup() {                 # optional: runs before the build
  :
}

post_install() {          # optional: runs after the app is installed
  :
}
```

## How a build works

1. Source `<slug>.conf` and check that `binary`, `appify`, `codesign` and
   everything in `requires` exist.
2. Run `setup`.
3. Run `appify` with the binary's real path, `args` and the Ghostty config.
4. If `~/.assets/<slug>/AppIcon.icns` exists, copy it into the bundle and
   register it in `Info.plist`. Appify's own PNG-to-ICNS conversion is
   unreliable.
5. Ad-hoc re-sign the bundle, since the icon change invalidates Appify's
   signature.
6. Replace the installed app. The previous version is restored if the swap
   fails.
7. Refresh Launch Services so Finder and Spotlight see the new app and icon.
8. Run `post_install`.

## Adding an app

1. Install the program, ideally via `~/.Brewfile`.
2. Create `<slug>.conf` with at least `name` and `binary`.
3. Optionally add `~/.assets/<slug>/AppIcon.icns` and `<slug>.ghostty`.
4. Run `~/.scripts/appify-tui.sh <slug>`.
