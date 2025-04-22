local path = require 'utils.path'

-- Auto commands

vim.api.nvim_create_autocmd('TextYankPost', {
  pattern = '*',
  callback = function()
    vim.highlight.on_yank { higroup = 'Visual', timeout = 200 }
  end,
})

-- User commands

vim.api.nvim_create_user_command('CopyAbsolutePath', function()
  local pathToCopy = path.get_absolute_path()
  vim.fn.setreg('+', pathToCopy)
  vim.notify('Copied "' .. pathToCopy .. '" to the clipboard!')
end, { desc = 'Copy the absolute path of the current file to the clipboard' })

vim.api.nvim_create_user_command('CopyRelativePath', function()
  local pathToCopy = path.get_relative_path()
  vim.fn.setreg('+', pathToCopy)
  vim.notify('Copied "' .. pathToCopy .. '" to the clipboard!')
end, { desc = 'Copy the relative path of the current file to the clipboard' })

vim.api.nvim_create_user_command('SplitSentences', function()
  vim.cmd [[%s/[.!?] /.\r/g]]
end, { desc = 'Place each sentence on a new line in the current buffer' })
