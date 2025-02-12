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
    { "<leader>gb", "<cmd>Gitsigns blame_line<cr>",          desc = "Toggle Git Blame" },
    { "<leader>gn", "<cmd>Gitsigns next_hunk<cr>",           desc = "Git Next Change" },
    { "<leader>gN", "<cmd>Gitsigns prev_hunk<cr>",           desc = "Git Previous Change" },
    { "<leader>gp", "<cmd>Gitsigns preview_hunk_inline<cr>", desc = "Git Previous Change" },
  }
}
