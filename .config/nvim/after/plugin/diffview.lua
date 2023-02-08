local status, diffview = pcall(require, "diffview")
if (not status) then return end

local actions = require("diffview.actions")

diffview.setup({
  view = {
    merge_tool = {
      -- Config for conflicted files in diff views during a merge or rebase.
      layout = "diff4_mixed",
      disable_diagnostics = true, -- Temporarily disable diagnostics for conflict buffers while in the view.
    },
  },
  keymaps = {
    disable_defaults = false, -- Disable the default keymaps
    view = {
      { "n", "gf", actions.goto_file_edit, { desc = "Open the file in the previous tabpage" } },
    },
    file_panel = {
      { "n", "gf", actions.goto_file_edit, { desc = "Open the file in the previous tabpage" } },
    },
    file_history_panel = {
      { "n", "gf", actions.goto_file_edit, { desc = "Open the file in the previous tabpage" } },
    },
  },
})

vim.keymap.set('n', '<Leader>gdo', '<cmd>DiffviewOpen<CR>')
vim.keymap.set('n', '<Leader>gdc', '<cmd>DiffviewClose<CR>')
vim.keymap.set('n', '<Leader>gdf', '<cmd>DiffviewFileHistory %<CR>')
