return {
  'bassamsdata/namu.nvim',
  opts = {},
  keys = {
    {
      '<leader>ss',
      ':Namu symbols<cr>',
      {
        desc = 'Jump to LSP symbol',
        silent = true,
      },
    },
  },
}
