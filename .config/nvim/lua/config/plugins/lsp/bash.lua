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
  setup = function(lspconfig, capabilities)
    lspconfig.bashls.setup { capabilites = capabilities }
  end
}
