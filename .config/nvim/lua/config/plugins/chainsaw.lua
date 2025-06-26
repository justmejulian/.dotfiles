-- debug / logging
return {
  'chrisgrieser/nvim-chainsaw',
  event = 'VeryLazy',
  opts = {},
  keys = {
    {
      'gp',
      function()
        require('chainsaw').variableLog()
      end,
      mode = { 'n', 'v' },
      desc = '[P]rint Variable',
    },
    {
      '<leader>clr',
      function()
        require('chainsaw').removeLogs()
      end,
      desc = '[L]ogs [R]emove',
    },
    {
      '<leader>clo',
      function()
        require('chainsaw').objectLog()
      end,
      mode = { 'n', 'v' },
      desc = '[L]ogs [O]bject',
    },
    {
      '<leader>cll',
      function()
        local marker = require('chainsaw.config.config').config.marker
        require('snacks').picker.grep_word {
          title = marker .. ' log statements',
          cmd = 'rg',
          args = { '--trim' },
          search = marker,
          regex = false,
          live = false,
        }
      end,
      desc = '[L]ogs [L]ist',
    },
  },
}
