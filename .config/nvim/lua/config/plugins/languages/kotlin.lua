return {
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'kotlin' } },
  },
  {
    'stevearc/conform.nvim',
    opts = {
      formatters_by_ft = {
        -- kotlin = { 'ktfmt' },
      },
    },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        kotlin_language_server = {
          post_setup = function() end,
        },
      },
    },
  },
}
