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

local function setup(lspconfig, capabilities)
  lspconfig.bashls.setup { capabilites = capabilities }
end

return {
  setup = setup
}
