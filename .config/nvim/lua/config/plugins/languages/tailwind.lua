return {
  {
    'ruicsh/tailwind-hover.nvim',
    keys = {
      { '<leader><s-k>', '<cmd>TailwindHover<cr>', desc = 'Tailwind: Hover' },
    },
    opts = {},
    dependencies = {
      'nvim-treesitter/nvim-treesitter',
    },
  },
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
