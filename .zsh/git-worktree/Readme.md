# Git Worktrees in bare repo

Inspired by:
- https://dev-notes.eu/2022/06/Branch-Management-With-Git-Worktree/
- https://morgan.cugerone.com/blog/workarounds-to-git-worktree-using-bare-repository-and-cannot-fetch-remote-branches/

## commands

```
gwt clone
gwt checkout
gwt checkout -b
gwt switch
gwt remove
```

## The project file structure:

```
folder
├── README.md
└── .bare
    └── config
    └── ... -- git stuff
└── .git -- tells git to check .bare
└── main
└── develop
└── feature
    ├── add-that-thing
    └── add-that-other-thing
└── bugfix
    ├── fix-42
    └── other-fix
```
