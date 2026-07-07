-- https://antoniorodr.github.io/lexy/
return {
  'antoniorodr/lexy.nvim',
  dependencies = {
    'folke/snacks.nvim',
  },
  opts = {},
  keys = {
    {
      ';ds',
      function()
        local data_dir = vim.fn.expand '~/.config/lexy/files/'
        local paths = vim.fn.glob(data_dir .. '*', false, true)
        local langs = vim.tbl_map(function(p)
          return vim.fn.fnamemodify(p, ':t:r')
        end, paths)
        require('snacks').picker.select(langs, { prompt = 'Lexy Language' }, function(choice)
          if choice then
            vim.cmd('LexySearch ' .. choice)
          end
        end)
      end,
      desc = 'Lexy Search',
    },
    { ';du', '<cmd>LexyUpdate<cr>', desc = 'Lexy Update' },
    {
      ';dd',
      function()
        vim.cmd('LexySearch ' .. vim.bo.filetype)
      end,
      desc = 'Lexy Search Language',
    },
  },
}
