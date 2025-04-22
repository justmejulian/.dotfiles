return {
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
