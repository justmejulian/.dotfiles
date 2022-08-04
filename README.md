# Dotfiles
my collection of dotfiles and scripts

## Set up

### Install git
Try to run git from the terminal. [If you don’t have it installed already, it will prompt you to install it.](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
```
git --version
```

### SSH key
Create .ssh dir
```
mkdir ~/.ssh
cd ~/.ssh
```

Generate a new SSH key
```
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Copy new key and [paste as new Key in Github](https://github.com/settings/ssh/new)
```
cat ~/.ssh/id_ed25519.pub | pbcopy
```

### Setup git bare repo
```
/bin/bash -c "$(curl -Lks "https://raw.githubusercontent.com/justmejulian/.dotfiles/main/.scripts/install.sh?token=GHSAT0AAAAAABRPPHUD3ALAPFLSA2UBCNAWYTWQXNQ")"
```

Update submodules
```
config submodule update --init
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
Install [vim-plug](https://github.com/junegunn/vim-plug)
```
sh -c 'curl -fLo "${XDG_DATA_HOME:-$HOME/.local/share}"/nvim/site/autoload/plug.vim --create-dirs \
       https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim'
```

```
cd ~/.config/coc/extensions
npm install
```

Reload neovim and `:PlugInstall` to install plugins.

### Set modifier keys

## ToDo
- Improve neovim config
  - move to lua
- Automate more using scripts
  - installing of US German Keyboard 
    - https://github.com/patrick-zippenfenig/us-with-german-umlauts
- Add macos defaults
  - add a lockfile to see what changed
    - `defaults read`
    - https://macos-defaults.com
- Don't auto expand all commands 
  - config
  - maybe use abbr and remove auto expand
    - https://github.com/olets/zsh-abbr
- Switch to coq and use native LSP
  - https://github.com/ms-jpq/coq_nvim
- improve github cli workflow
  - https://blog.jez.io/cli-code-review/
