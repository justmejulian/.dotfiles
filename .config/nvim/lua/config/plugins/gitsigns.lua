return { -- Adds git related signs to the gutter, as well as utilities for managing changes
  'lewis6991/gitsigns.nvim',
  lazy = false,
  opts = {
    signs = {
      add = { text = '+' },
      change = { text = '~' },
      delete = { text = '_' },
      topdelete = { text = '‾' },
      changedelete = { text = '~' },
    },
  },
  keys = {
    { '<leader>gb', '<cmd>Gitsigns blame_line<cr>', desc = '[G]it [B]lame' },
    { '<leader>gn', '<cmd>Gitsigns next_hunk<cr>', desc = '[G]it [N]ext Change' },
    { '<leader>gp', '<cmd>Gitsigns prev_hunk<cr>', desc = '[G]it [P]revious Change' },
    { '<leader>ghp', '<cmd>Gitsigns preview_hunk_inline<cr>', desc = '[G]it [H]unk [P]review Inline' },
    { '<leader>ghs', '<cmd>Gitsigns stage_hunk<cr>', desc = '[G]it [H]unk [S]tage' },
    { '<leader>ghr', '<cmd>Gitsigns reset_hunk<cr>', desc = '[G]it [H]unk [R]eset' },
  },
}
