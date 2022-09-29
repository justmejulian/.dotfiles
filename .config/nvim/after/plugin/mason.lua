local status, mason = pcall(require, "mason")
if (not status) then return end
local status2, lspconfig = pcall(require, "mason-lspconfig")
if (not status2) then return end

mason.setup({})

lspconfig.setup {
  ensure_installed = { "sumneko_lua", "tailwindcss" },
}

vim.keymap.set('n', '<Leader>m', '<Cmd>Mason<CR>', {desc="Mason"})
