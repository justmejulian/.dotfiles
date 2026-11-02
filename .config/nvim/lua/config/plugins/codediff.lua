return {
  'esmuellert/codediff.nvim',
  version = '>=3.0.0',
  cmd = 'CodeDiff',
  opts = {
    diff = { layout = 'inline' },
    explorer = { view_mode = 'tree' },
    keymaps = {
      view = {
        quit = { 'q', '<leader>gdc' },
        next_file = { ']f', '<Tab>' },
        prev_file = { '[f', '<S-Tab>' },
        stage_hunk = '<leader>ghs',
        unstage_hunk = '<leader>ghu',
        discard_hunk = '<leader>ghr',
      },
      conflict = {
        -- Preserve the meanings used in the previous Diffview setup.
        accept_both = '<leader>ca',
        discard = '<leader>cb',
        accept_all_both = '<leader>cA',
        discard_all = '<leader>cB',
      },
    },
  },
  keys = {
    { '<leader>gdo', '<cmd>CodeDiff<cr>', desc = '[G]it [D]iff [O]pen' },
    {
      '<leader>gdb',
      function()
        local sha = require('config.git_base').merge_base()
        if sha then
          vim.cmd('CodeDiff ' .. sha)
        end
      end,
      desc = '[G]it [D]iff [B]ranch',
    },
  },
}
