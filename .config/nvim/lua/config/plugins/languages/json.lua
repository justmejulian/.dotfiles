return {
  {
    'stevearc/conform.nvim',
    opts = { formatters_by_ft = { jsonc = { 'prettier' } } },
  },
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'json' } },
  },
}
