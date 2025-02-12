return {
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'javascript', 'typescript' } },
  },
  {
    'williamboman/mason-lspconfig.nvim',
    dependencies = {
      "williamboman/mason.nvim",
    },
    opts = { languages = { 'vtsls' } },
  },
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        vtsls = {}
      }
    }
  }
}
