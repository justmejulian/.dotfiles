return {
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'css' } },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        cssls = {
          post_setup = function() end,
        },
      },
    },
  },
}
