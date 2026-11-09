# Herdr

Config for Herdr.app (`brew install --cask herdr-app`). Only my own files are in the dotfiles: `keys.json`, `settings.json`, `layouts/main-copy.json` and `mods/worktree-tabs`. Herdr writes the rest.

## Worktrees

Git worktrees live in `~/Documents/git/worktree/<repo>/<branch>`, with slashes in the branch name as dashes (`julian/foo` → `julian-foo`). Each one opens as a Herdr space with three tabs: `pi`, `lazygit` and `shell`.

### Set up

Herdr's own New/Open worktree dialog puts checkouts in `~/.herdr/worktrees`. Point that at the worktree folder, once per machine:

```sh
mkdir -p ~/Documents/git/worktree ~/.herdr
ln -s ~/Documents/git/worktree ~/.herdr/worktrees
```

Git stores the real path, so `git worktree list` and the dialog show `~/Documents/git/worktree/…`.

### New worktree

Either use Herdr's New worktree dialog, or from a shell inside the repo:

```sh
hc-worktree new <branch> [repo]
```

`hc-worktree` (`~/.local/bin/hc-worktree`) fetches `origin/main` and starts new branches from it. Herdr's dialog starts them from the repo's current `HEAD` instead. An existing branch is checked out as is.

### Open a worktree

Herdr's Open worktree dialog, or:

```sh
hc-worktree open <folder>
```

If a space already shows that folder it is selected, otherwise a new one is made.

### Tabs

`mods/worktree-tabs` adds the `pi`, `lazygit` and `shell` tabs to spaces that Herdr's dialog makes, by calling `hc-worktree tabs <space-id>`. It is in `layouts/main-copy.json` as an empty floating block, since a mod only runs while it is in the layout. It only touches new spaces under the worktree folder that still have their single unnamed tab.

### Env files

Git doesn't copy ignored files like `.env` into a new worktree. List them in a `.worktreeinclude` in the main checkout and the global `post-checkout` hook copies them, whichever way the worktree was made. See [`~/.hooks/Readme.md`](../../.hooks/Readme.md).
