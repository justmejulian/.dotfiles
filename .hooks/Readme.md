# Git Hooks

This folder contains some scripts that I find useful as [git hooks](https://git-scm.com/book/ms/v2/Customizing-Git-Git-Hooks).

## How to use

Copy the hook into the  `.git/hooks` folder of a repo.
Then rename it to match the hook you want to use.

```
cp semanticCommitMessages.sh ~/git/cool-repo/.git/hooks/prepare-commit-msg
```
