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
