local status, navbuddy = pcall(require, "nvim-navbuddy")
if (not status) then return end

navbuddy.setup { lsp = {
  auto_attach = true,
  preference = { 'vtsls', 'lua_ls' }
} }

vim.keymap.set('n', ';n', navbuddy.open, { desc = "NavBuddy" })
