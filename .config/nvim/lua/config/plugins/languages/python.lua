return {
  {
    'stevearc/conform.nvim',
    opts = { formatters_by_ft = { typst = { 'black' } } },
  },
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'python' } },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        pyright = {
          post_setup = function() end,
        },
      },
    },
  },
}
