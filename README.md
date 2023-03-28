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

Add it to keychain
```
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

Copy new key and [paste as new Key in Github](https://github.com/settings/ssh/new)
```
pbcopy < ~/.ssh/id_ed25519.pub
```

### Setup git bare repo
Clones, sets up config alias and updates submodules.
```
/bin/bash -c "$(curl -Lks "https://raw.githubusercontent.com/justmejulian/.dotfiles/main/.scripts/install.sh?token=GHSAT0AAAAAABRPPHUD3ALAPFLSA2UBCNAWYTWQXNQ")"
```

### Install Homebrew
[brew.sh](https://brew.sh)
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Make sure you follow the __Next Steps__

Install packages
```
brew bundle install --file ~/.Brewfile
```

### Neovim
Install [packer](https://github.com/wbthomason/packer.nvim)
```
git clone --depth 1 https://github.com/wbthomason/packer.nvim\
 ~/.local/share/nvim/site/pack/packer/start/packer.nvim
```

Reload neovim and `:PackerInstall` to install plugins.

### Set modifier keys

## ToDo
- Automate more using scripts
  - installing of US German Keyboard 
    - https://github.com/patrick-zippenfenig/us-with-german-umlauts
    -  git clone https://github.com/patrick-zippenfenig/us-with-german-umlauts.git
    - cd us-with-german-umlauts
    - sudo mv US-with-German-Umlauts.bundle /Library/Keyboard\ Layouts/
- git hooks
- git diff
- zsh package manager
- Add macos defaults
  - add a lockfile to see what changed
    - `defaults read`
    - https://macos-defaults.com
    - https://www.defaults-write.com/
    - defaults write com.apple.finder "AppleShowAllFiles" -bool "true" && killall Finder
    - defaults write NSGlobalDomain "AppleShowAllExtensions" -bool "true" && killall Finder
    - defaults write com.apple.dock "mru-spaces" -bool "false" && killall Dock
    - defaults write com.apple.TextEdit "RichText" -bool "false" && killall TextEdit
    - defaults write com.apple.finder "FXPreferredViewStyle" -string "Nlsv" && killall Finder
    -  defaults write com.apple.finder "FXEnableExtensionChangeWarning" -bool "false" && killall Finder
    - defaults write com.apple.dock "tilesize" -int "40" && killall Dock
- improve github cli workflow
  - https://blog.jez.io/cli-code-review/
- checkin .zshprofile
- automate neovim treesitter stuff
- better structure to this repo
- finicky.js
- make sure tracking everything
 - config status ~/.config -u
 - config status ~/.ssh -u
 - config status ~/.scripts -u
- better which key descriptons
- make sure using pyenv for python and not custom python versions from brew
  0 https://wilsonmar.github.io/pyenv/
  - smae for node usnign nvm and java using whatever  
