return {
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'typst' } },
  },
  {
    'williamboman/mason-lspconfig.nvim',
    dependencies = {
      "williamboman/mason.nvim",
    },
    opts = { languages = { 'tinymist' } },
  },
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        tinymist = {}
      }
    }
  }
}
