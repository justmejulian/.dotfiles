# revu.nvim

Neovim plugin for [revu](https://github.com/justmejulian/scripts/tree/main/revu) — a CLI tool for reviewing Azure DevOps pull requests from the terminal.

## Features

- Search all PR comment threads in a Snacks.picker
- Insert `REVU[NEW]` inline comments at the cursor (posted later via `revu upload`)
- Remove all injected `REVU[...]` comments from source files

## Keymaps

| Key | Action |
|-----|--------|
| `<leader>rs` | Open picker with all PR comment threads |
| `<leader>ra` | Add `REVU[NEW]` comment above current line |
| `<leader>rc` | Run `revu sync --clean` — remove all injected comments |

## Highlight groups

| Group | fg | bg | Meaning |
|-------|----|----|---------|
| `RevuNew` | `#ff9e64` orange | `#3b2a1a` | `REVU[NEW]` — not yet uploaded |
| `RevuId` | `#7aa2f7` blue | `#1a2340` | `REVU[123]` — existing thread |
| `RevuText` | `#9ece6a` green | `#1e2d16` | Comment text after the marker |

Override any group in your colorscheme config before `setup_highlight()` is called.

## Requirements

- [`revu`](https://github.com/justmejulian/scripts/tree/main/revu) binary in `$PATH`
- [`snacks.nvim`](https://github.com/folke/snacks.nvim) (for the picker)
- Must be run from inside a git repository
