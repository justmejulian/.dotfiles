local status, printer = pcall(require, "debugprint")
if (not status) then return end

printer.setup({
  keymaps = {
    normal = {
      plain_below = nil,
      plain_above = nil,
      variable_below = "<Leader>rp",
      variable_above = "<Leader>rP",
      variable_below_alwaysprompt = nil,
      variable_above_alwaysprompt = nil,
      textobj_below = nil,
      textobj_above = nil,
      toggle_comment_debug_prints = nil,
      delete_debug_prints = nil,
    },
    visual = {
      variable_below = "g?v",
      variable_above = "g?V",
    },
  },
  commands = {
    toggle_comment_debug_prints = "ToggleCommentDebugPrints",
    delete_debug_prints = "DeleteDebugPrints",
  },
})

vim.keymap.set({ "n" }, "<Leader>rf",
  function() require("telescope.builtin").grep_string { default_text = "DEBUGPRINT" } end)
