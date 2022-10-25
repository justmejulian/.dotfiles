--vim.lsp.set_log_level("debug")

local status, nvim_lsp = pcall(require, "lspconfig")
if (not status) then return end

local protocol = require('vim.lsp.protocol')

vim.api.nvim_create_autocmd(
  { "BufWritePre" },
  { pattern = { "*.tsx", "*.ts", "*.js", "*.jsx" }, command = "EslintFixAll" }
)

protocol.CompletionItemKind = {
  '', -- Text
  '', -- Method
  '', -- Function
  '', -- Constructor
  '', -- Field
  '', -- Variable
  '', -- Class
  'ﰮ', -- Interface
  '', -- Module
  '', -- Property
  '', -- Unit
  '', -- Value
  '', -- Enum
  '', -- Keyword
  '﬌', -- Snippet
  '', -- Color
  '', -- File
  '', -- Reference
  '', -- Folder
  '', -- EnumMember
  '', -- Constant
  '', -- Struct
  '', -- Event
  'ﬦ', -- Operator
  '', -- TypeParameter
}

-- Diagnostic symbols in the sign column (gutter)
local signs = { Error = " ", Warn = " ", Hint = " ", Info = " " }
for type, icon in pairs(signs) do
  local hl = "DiagnosticSign" .. type
  vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = "" })
end

vim.diagnostic.config({
  virtual_text = {
    prefix = '●'
  },
  float = {
    source = "always", -- Or "if_many"
  },
  severity_sort = true,
  update_in_insert = false,
})

vim.keymap.set('n', '<leader>dn', vim.diagnostic.goto_next, { desc = "diagnostic next" })
vim.keymap.set('n', '<leader>dN', vim.diagnostic.goto_prev, { desc = "diagnostic prev" })
vim.keymap.set('n', '<leader>df', vim.diagnostic.open_float, { desc = "diagnostic float" })
