return {
  {
    'stevearc/conform.nvim',
    opts = { formatters_by_ft = { lua = { 'stylua' } } },
  },
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'lua' } },
  },
  {
    'folke/lazydev.nvim',
    ft = 'lua',
    opts = {
      library = {
        { path = '${3rd}/luv/library', words = { 'vim%.uv' } },
        { path = 'snacks.nvim', words = { 'Snacks' } },
        { path = 'lazy.nvim', words = { 'LazyVim' } },
      },
    },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        lua_ls = {
          post_setup = function() end,
        },
      },
    },
  },
}
