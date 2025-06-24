return {
  'smjonas/inc-rename.nvim',
  config = function()
    require('inc_rename').setup {}
    vim.keymap.set('n', '<leader>cn', function()
      return ':IncRename ' .. vim.fn.expand '<cword>'
    end, { expr = true, desc = 'Re[n]ame' })
  end,
}
