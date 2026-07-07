return {
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'clojure' } },
  },
  {
    'stevearc/conform.nvim',
    opts = {
      formatters_by_ft = {
        clojure = { 'cljfmt' },
      },
    },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        clojure_lsp = {
          post_setup = function() end,
        },
      },
    },
  },
  {
    'Olical/conjure',
    ft = { 'clojure' },
    init = function()
      vim.g['conjure#mapping#doc_word'] = 'K'
    end,
  },
}
