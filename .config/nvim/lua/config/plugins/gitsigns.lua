local function nav_hunk(direction)
  return function()
    if vim.wo.diff then
      -- Keep Vim's native navigation in windows that use Vim's diff mode.
      local key = direction == 'next' and ']c' or '[c'
      vim.cmd.normal { args = { vim.v.count1 .. key }, bang = true }
    else
      require('gitsigns').nav_hunk(direction)
    end
  end
end

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
    { ']c', nav_hunk 'next', desc = 'Next changed hunk' },
    { '[c', nav_hunk 'prev', desc = 'Previous changed hunk' },
    { '<leader>ghp', '<cmd>Gitsigns preview_hunk_inline<cr>', desc = '[G]it [H]unk [P]review Inline' },
    { '<leader>ghs', '<cmd>Gitsigns stage_hunk<cr>', desc = '[G]it [H]unk [S]tage' },
    { '<leader>ghr', '<cmd>Gitsigns reset_hunk<cr>', desc = '[G]it [H]unk [R]eset' },
    {
      '<leader>ght',
      function()
        local gitsigns = require 'gitsigns'
        if vim.g.gitsigns_branch_base then
          vim.g.gitsigns_branch_base = nil
          gitsigns.reset_base(true)
          vim.notify 'Gitsigns: hunks vs index'
          return
        end
        local sha = require('config.git_base').merge_base()
        if sha then
          vim.g.gitsigns_branch_base = sha
          gitsigns.change_base(sha, true)
          vim.notify 'Gitsigns: hunks vs branch base'
        end
      end,
      desc = '[G]it [H]unk [T]oggle base (index / branch)',
    },
  },
}
