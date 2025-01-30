return {
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
    lazy = false,
    config = function()
      require('nvim-treesitter.configs').setup({
        -- todo: auto add by language
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
          "lua",
          "typst"
        },
        sync_install = false,
        highlight = { enable = true },
        indent = { enable = true },
        -- todo: does this work?
        incremental_selection = {
          enable = true,
          keymaps = {
            init_selection = "<leader>v",
            node_incremental = "<leader>v",
            scope_incremental = false,
            node_decremental = "<leader>V",
          },
        },
      })
    end
  }
}
