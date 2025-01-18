# Git Hooks

This folder contains some scripts that I find useful as [git hooks](https://git-scm.com/book/ms/v2/Customizing-Git-Git-Hooks).

## How to use

Create the hook you want to use and source my hook into it.

```
cd cool-repo
echo "source '$PWD/semanticCommitMessages.sh'" >> .git/hooks/prepare-commit-msg
```
