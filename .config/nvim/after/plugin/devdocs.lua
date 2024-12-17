local status, devdocs = pcall(require, "nvim-devdocs")
if (not status) then return end

vim.keymap.set('n', ';dd', function() devdocs.open_doc_float({ fargs = {} }) end, { noremap = true, silent = true })
vim.keymap.set('n', ';dc', devdocs.open_doc_current_file, { noremap = true, silent = true })
devdocs.setup({
  after_open = function(bufnr)
    vim.api.nvim_buf_set_keymap(bufnr, 'n', '<Esc>', ':close<CR>', {})
  end
})
