# Git Hooks

This folder contains some scripts that I find useful as [git hooks](https://git-scm.com/book/ms/v2/Customizing-Git-Git-Hooks).

## How to use

Create the hook you want to use and source my hook into it.

```
cd cool-repo
echo "source '$PWD/semanticCommitMessages.sh'" >> .git/hooks/prepare-commit-msg
```

## Global: filter Claude co-author lines

`filterClaudeCoAuthor.sh` strips `Co-Authored-By: Claude …` from every commit message. It's run globally from `~/.git-hooks/commit-msg` (`git config --global core.hooksPath ~/.git-hooks`). Most hooks in `~/.git-hooks` end by forwarding to the repo's own `.git/hooks` (`_run-local`), so per-repo hooks keep working. `post-commit`, `post-merge` and `pre-push` only run Git LFS (and the pi push guard) and don't forward.

## Global: copy env files into new worktrees

Git doesn't copy ignored files like `.env` into a new worktree. `~/.git-hooks/_worktree-include`, run from `post-checkout`, copies the ones a repo lists in `.worktreeinclude`.

Put `.worktreeinclude` in the main checkout. It takes gitignore patterns:

```
.env
packages/*/.env.local
.envrc
```

To keep it out of the repo, add it to that repo's `.git/info/exclude`:

```
echo .worktreeinclude >> .git/info/exclude
```

- It runs on `git worktree add` only, not on `git clone` or a normal checkout or switch, so it works the same for Herdr, `hc-worktree` and plain git.
- It only copies files git doesn't track, and never overwrites a file the worktree already has.
- Files are copied, not linked: changing one worktree's `.env` doesn't affect the others.
- Don't list big folders like `node_modules/`; every file in them is copied.

To fill a worktree that already exists, run it there by hand:

```
~/.git-hooks/_worktree-include
```
