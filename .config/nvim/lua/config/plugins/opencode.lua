return {
  {
    'NickvanDyke/opencode.nvim',
    config = function()
      ---@type opencode.Opts
      vim.g.opencode_opts = {}
    end,
    keys = {
      {
        '<leader>o',
        function()
          require('opencode').select()
        end,
        desc = 'Ask [o]pencode',
        mode = { 'n', 'v' },
      },
    },
  },
}
