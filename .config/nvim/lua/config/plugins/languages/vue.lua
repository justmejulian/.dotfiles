return {
  {
    'stevearc/conform.nvim',
    opts = { formatters_by_ft = {
      vue = { 'prettier' },
    } },
  },
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'vue' } },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        vue_ls = {
          post_setup = function() end,
        },
      },
    },
  },
}
