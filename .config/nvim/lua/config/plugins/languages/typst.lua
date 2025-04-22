return {
  {
    'stevearc/conform.nvim',
    opts = { formatters_by_ft = { typst = { 'typstyle' } } },
  },
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'typst' } },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        tinymist = {
          post_setup = function() end,
        },
      },
    },
  },
}
