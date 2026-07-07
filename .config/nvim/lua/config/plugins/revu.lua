return {
  {
    dir = vim.fn.stdpath 'config' .. '/local/revu.nvim',
    name = 'revu.nvim',
    lazy = false,
    config = function()
      require('revu').setup_highlight()
    end,
    keys = {
      {
        '<leader>rs',
        function()
          require('revu').search()
        end,
        desc = 'PR [S]earch Comments',
      },
      {
        '<leader>rc',
        function()
          require('revu').clean()
        end,
        desc = 'PR [C]lean Comments',
      },
      {
        '<leader>ra',
        function()
          require('revu').add()
        end,
        desc = 'PR [A]dd Comment',
      },
    },
  },
}
