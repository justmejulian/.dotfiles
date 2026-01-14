return {
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        tailwindcss = {
          post_setup = function() end,
        },
      },
    },
  },
}
