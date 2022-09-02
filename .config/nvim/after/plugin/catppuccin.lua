local status, n = pcall(require, "catppuccin")
if (not status) then return end

vim.g.catppuccin_flavour = "mocha" -- latte, frappe, macchiato, mocha

vim.cmd [[colorscheme catppuccin]]
