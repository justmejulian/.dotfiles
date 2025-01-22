return {
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
    opts = {
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
      sync_install = false,
      highlight = { enable = true },
      indent = { enable = true },
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
  }
}
