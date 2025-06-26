return {
  {
    'stevearc/conform.nvim',
    opts = { formatters_by_ft = {
      astro = { 'prettierd' },
      typescriptreact = { 'prettierd' },
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
