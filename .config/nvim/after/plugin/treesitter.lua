local status, ts = pcall(require, "nvim-treesitter.configs")
if (not status) then return end

ts.setup {
  highlight = {
    enable = true,
    disable = {},
  },
  indent = {
    enable = true,
    disable = {},
  },
  ensure_installed = {
    'regex',
    'markdown',
    'markdown_inline',
    'bash',
    'astro',
    "tsx",
    'typescript',
    "php",
    "json",
    "yaml",
    "css",
    "html",
    "python",
    "vimdoc",
    "lua"
  },
  incremental_selection = {
    enable = true,
    keymaps = {
      init_selection = "<Leader>v",
      node_incremental = "<Leader>v",
      scope_incremental = false,
      node_decremental = "<Leader>V",
    },
  },
}

local parser_config = require "nvim-treesitter.parsers".get_parser_configs()
parser_config.tsx.filetype_to_parsername = { "javascript", "typescript.tsx" }

local status2, ts_context = pcall(require, "treesitter-context")
if (not status2) then return end

ts_context.setup {}
