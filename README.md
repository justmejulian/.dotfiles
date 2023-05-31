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
