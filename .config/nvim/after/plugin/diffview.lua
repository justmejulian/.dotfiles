local status, diffview = pcall(require, "diffview")
if (not status) then return end

diffview.setup()

vim.keymap.set('n', '<Leader>gdo', '<cmd>DiffviewOpen<CR>')
vim.keymap.set('n', '<Leader>gdc', '<cmd>DiffviewClose<CR>')
vim.keymap.set('n', '<Leader>gdf', '<cmd>DiffviewFileHistory %<CR>')
