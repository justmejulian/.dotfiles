return {
  'andrewferrier/debugprint.nvim',
  opts = {
    keymaps = {
      normal = {
        variable_below = 'gp',
      },
      visual = {
        variable_below = 'gp',
      },
    },
    commands = {
      toggle_comment_debug_prints = 'ToggleCommentDebugPrints',
      delete_debug_prints = 'DeleteDebugPrints',
    },
  },
}
