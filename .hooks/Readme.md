# Git Hooks

This folder contains some scripts that I find useful as [git hooks](https://git-scm.com/book/ms/v2/Customizing-Git-Git-Hooks).

## How to use

Create the hook you want to use and source my hook into it.

```
cd cool-repo
echo "source '$PWD/semanticCommitMessages.sh'" >> .git/hooks/prepare-commit-msg
```

## Global: filter Claude co-author lines

`filterClaudeCoAuthor.sh` strips `Co-Authored-By: Claude …` from every commit message. It's run globally from `~/.git-hooks/commit-msg` (`git config --global core.hooksPath ~/.git-hooks`). The other hooks in `~/.git-hooks` just forward to each repo's own `.git/hooks`, so per-repo hooks keep working.
