# Dotfiles

my collection of dotfiles and scripts

## Set up

### Install git

Try to run git from the terminal. [If you don’t have it installed already, it will prompt you to install it.](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

```
git --version
```

### xcode

Helps solve a couple problems, including `"clang" command requires the command line developer tools.`

```
xcodebuild -runFirstLaunch
```

### SSH key

Create .ssh dir

```
mkdir ~/.ssh
cd ~/.ssh
eval "$(ssh-agent -s)"
```

Generate a new SSH key

```
ssh-keygen -t ed25519 -C "12615757+justmejulian@users.noreply.github.com"
```

Copy new key and [paste as new Key in Github](https://github.com/settings/ssh/new)

```
pbcopy < ~/.ssh/id_ed25519.pub
```

Create `~/.ssh/config` file and add key to github.

```
Host github.com
   HostName github.com
   User git
   IdentityFile ~/.ssh/id_ed25519
```

#### Addind to keychain

If you are using passphrases, then you might want to add it to keychain.

See [Github](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)

Make sure you are using the mac ssh-add:

```
❯ which ssh-add
/usr/bin/ssh-add
```

Add to keychain:

```
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

### Setup git bare repo

Clones, sets up config alias and updates submodules.

```
/bin/bash -c "$(curl -Lks "https://raw.githubusercontent.com/justmejulian/.dotfiles/main/.scripts/install.sh")"

```

Set remote url:

```
source ~/.zshrc
config remote set-url origin git@github.com:justmejulian/.dotfiles.git
```

### Homebrew

[brew.sh](https://brew.sh)

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Make sure you follow the **Next Steps**

Install packages

```
brew bundle install --file ~/.Brewfile
```

#### mas (Mac App Store)

Find an app's ID:

```
mas search "Pixelmator Pro"
```

Add it to `~/.Brewfile` so it installs via `brew bundle`:

```
mas "Pixelmator Pro", id: 1289583905
```

Or install directly:

```
mas install 1289583905
```

### Standalone TUI

Use [appify](https://github.com/mattrobenolt/appify) to create standalone TUI apps.

#### GitHub Dashboard app

[`gh-dash`](https://github.com/dlvhdr/gh-dash) is packaged as a standalone
fullscreen macOS app with Appify. Rebuild and install it after setting up the
dotfiles:

```sh
~/.scripts/install-gh-dash-app.sh
```

The generated app is installed at `~/Applications/GitHub Dashboard.app`. Its
icon and Ghostty configuration live in `~/.assets/gh-dash/` and
`~/.config/appify/`.

### Tailscale

Start the Homebrew Tailscale service and connect:

```sh
sudo brew services start tailscale
tailscale up
```

Follow the login link, then verify the connection:

```sh
tailscale status
```

Starting the service enables it at boot and fixes errors such as `failed to connect to local Tailscale service` or a missing `/var/run/tailscaled.socket`.

See [Tailscale’s macOS instructions](https://github.com/tailscale/tailscale/wiki/Tailscaled-on-macOS).

### mise

Node and Python are managed by [mise](https://mise.jdx.dev) (replaces `nvm` and `pyenv`).

Install a runtime globally:

```
mise use -g node@lts
mise use -g python@latest
mise use -g go@latest
mise use -g java@latest
```

### Ollama

Start the [Ollama](https://ollama.com) server as a background service (this also registers it to launch at login):

```
brew services start ollama
```

Pull the models used by the `scripts` repo's `ollama` provider:

```
ollama pull qwen3.5:2b-mlx
ollama pull qwen3.5:4b-mlx
ollama pull qwen3.5:27b-mlx
ollama pull gemma4:e2b-mlx
ollama pull gemma4:12b-mlx
```

### Neovim

Make sure all it setup.

```
checkhealth
```

### Scripts

Clone and install scripts:

```
git@github.com:justmejulian/scripts.git
go install ./...
```

### Defaults

macOS settings are captured in `~/.scripts/defaults/set_defaults.sh`:

```
bash ~/.scripts/defaults/set_defaults.sh
```

New settings are captured incrementally with `defsync` (part of the `scripts` repo) instead of
hand-writing `defaults write` commands. See
[`~/.scripts/defaults/Readme.md`](.scripts/defaults/Readme.md) for the full workflow.

#### Full Disk Access

```
open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
```

Add Ghostty in the list that opens, restart it, then retry.

### Keyboard

Install [Mac US keyboard layout with German Umlauts](https://github.com/patrick-zippenfenig/us-with-german-umlauts)
and make it the only enabled layout.

```
bash ~/.scripts/set_keyboard.sh
```

Log out / restart afterwards for the input source to take effect.

To check the result:

```
open ~/Library/Preferences/com.apple.HIToolbox.plist
```

#### Hyperkey

[⌃⌥⌘](https://hyperkey.app/)

- Remap `caps lock` to hyper key
- quick press `caps lock` to `esc`
- do not include shift in hyper key

### Menu Bar

Use [Ice](https://github.com/jordanbaird/Ice) to hide unwanted MenuBar Items.

### System Cleanup

Use [Mole](https://github.com/tw93/Mole) to deep clean and optimize your Mac.

Useful commands:

```
mo                    # Interactive menu
mo clean              # Deep cleanup
mo uninstall          # Remove apps + leftovers
mo optimize           # Refresh caches & services
mo analyze            # Visual disk explorer
mo status             # Live system health dashboard
```

### Possible Errors

#### zsh

```
zsh compinit: insecure directories, run compaudit for list
```

Running `compaudit` will show you which files.

Loop through all those files and give them the correct permissions.

```
for f in $(compaudit);do sudo chmod -R 755 $f;done;
```
