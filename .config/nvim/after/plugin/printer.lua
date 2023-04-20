local status, printer = pcall(require, "debugprint")
if (not status) then return end

printer.setup({
  create_keymaps = false,
  create_commands = true
})

vim.keymap.set({ "n", "v" }, "<Leader>rp", function() return printer.debugprint({ variable = true }) end, {
  expr = true,
})
vim.keymap.set({ "n", "v" }, "<Leader>rP", function() return printer.debugprint({ variable = true, above = true }) end, {
  expr = true,
})
