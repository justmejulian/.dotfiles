return {
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
    lazy = false,
    dependencies = {
      "nvim-treesitter/nvim-treesitter-textobjects",
    },
    opts_extend = { 'languages' }, -- extend not merge
    opts = {
        languages = {},
    },
    config = function(_, opts)
      require('nvim-treesitter.configs').setup({
        ensure_installed = opts.languages,
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
