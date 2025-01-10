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
ssh-add ~/.ssh/id_ed25519
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

Set remote url:
```
config remote set-url origin git@github.com:justmejulian/.dotfiles.git
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

### Keyboard

Install [Mac US keyboard layout with German Umlauts](https://github.com/patrick-zippenfenig/us-with-german-umlauts).

```
curl -sL https://api.github.com/repos/patrick-zippenfenig/us-with-german-umlauts/tarball/master | sudo tar xz --exclude=README.md --strip=1 -C /Library/Keyboard\ Layouts/
```

#### Hyperkey

[⌃⌥⌘](https://hyperkey.app/)

- Remap `caps lock` to hyper key
- quick press `caps lock` to `esc`
- do not include shift in hyper key

#### Window Resizing

Using built-in:

```
System Settings > Keyboard > Shortcuts > App Shortcuts > Click the "+" button > Set Application to "All Applications"
```


Add the following:
(Yes just Left/Right, like the exact menu command name)

```
Left  -> Hyper + Left Arrow
Right -> Hyper + Right Arrow
```

Maybe look at [AeroSpace](https://github.com/nikitabobko/AeroSpace)

Or handle with [Raycast](https://www.albertosadde.com/blog/raycast/)

### Menu Bar

Use [Ice](https://github.com/jordanbaird/Ice) to hide unwanted MenuBar Items.

### Dev Env

#### Node

Make sure `nvm` is installed.

```
nvm -v
```

Install the latest node version.

```
nvm install node
```

#### python

```
pyenv install 3.13.1
pyenv global 3.13.1
```

#### Java

add version to JAVA_HOME

```
export JAVA_HOME=`/usr/libexec/java_home -v 12.0.1`
```

#### Neovim

Make sure all it setup.

```
checkhealth
```

Set the correct node version.

```
todo
```

### Raycast

https://www.stefanimhoff.de/raycast/


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
