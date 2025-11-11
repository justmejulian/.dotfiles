return {
  'sindrets/diffview.nvim',
  lazy = false,
  opts = {
    view = {
      merge_tool = {
        layout = 'diff3_mixed',
      },
    },
  },
  keys = {
    { '<leader>gdo', '<cmd>DiffviewOpen<cr>', desc = '[G]it [D]iffview [O]pen' },
    { '<leader>gdc', '<cmd>DiffviewClose<cr>', desc = '[G]it [D]iffview [C]lose' },
  },
}
