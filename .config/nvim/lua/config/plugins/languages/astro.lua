return {
  {
    'stevearc/conform.nvim',
    opts = { formatters_by_ft = {
      astro = { 'prettier' },
      typescriptreact = { 'prettier' },
    } },
  },
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'astro' } },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        astro = {
          post_setup = function() end,
        },
      },
    },
  },
}
