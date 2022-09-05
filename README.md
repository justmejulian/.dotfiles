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
Install [packer](https://github.com/wbthomason/packer.nvim)
```
git clone --depth 1 https://github.com/wbthomason/packer.nvim\
 ~/.local/share/nvim/site/pack/packer/start/packer.nvim
```

Reload neovim and `:PackerInstall` to install plugins.

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
- autocomplete javascript
  - https://github.com/williamboman/mason.nvim/discussions/57
```
local lspconfig = require("lspconfig")

require("mason-lspconfig").setup_handlers {
    -- This is a default handler that will be called for each installed server (also for new servers that are installed during a session)
    function (server_name)
       lspconfig[server.name].setup {}
   end,
   -- You can also override the default handler for specific servers by providing them as keys, like so:
   ["rust_analyzer"] = function ()
     require("rust-tools").setup {}
   end
}
```
  - https://stackoverflow.com/questions/63038349/visual-studio-code-autocomplete-add-parentheses-after-method-in-js-file
