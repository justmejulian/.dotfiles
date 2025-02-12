-- todo move this
vim.filetype.add({
  filename = {
    [".env"] = "dotenv",
  },
  pattern = {
    [".env"] = "dotenv",
    [".env.*"] = "dotenv",
  },
})

vim.treesitter.language.register('bash', 'dotenv')

return {
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'bash' } },
  },
  {
    'williamboman/mason-lspconfig.nvim',
    dependencies = {
      "williamboman/mason.nvim",
    },
    opts = { languages = { 'bashls' } },
  },
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        bashls = {}
      }
    }
  }
}
