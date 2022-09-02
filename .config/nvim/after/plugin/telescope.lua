local status, telescope = pcall(require, "telescope")
if (not status) then return end
local actions = require('telescope.actions')
local builtin = require("telescope.builtin")

local function telescope_buffer_dir()
  return vim.fn.expand('%:p:h')
end

telescope.setup {}

telescope.load_extension("file_browser")

vim.keymap.set('n', '<Leader>ff',
  function()
    builtin.find_files({
      no_ignore = false,
      hidden = true
    })
  end, { desc = "telescope find_files" })
vim.keymap.set('n', '<Leader>fg', function()
  builtin.live_grep()
end, { desc = "telescope live_grep" })
vim.keymap.set('n', '<Leader>fb', function()
  builtin.buffers()
end, { desc = "telescope buffers" })
vim.keymap.set('n', '<Leader>fh', function()
  builtin.help_tags()
end, { desc = "telescope help_tags" })
vim.keymap.set('n', '<Leader>fd', function()
  builtin.diagnostics()
end, { desc = "telescope diagnostics" })
vim.keymap.set("n", "<Leader>fe", function()
  telescope.extensions.file_browser.file_browser({
    path = "%:p:h",
    cwd = telescope_buffer_dir(),
    respect_gitignore = false,
    hidden = true,
    grouped = true,
    initial_mode = "normal",
    layout_config = { height = 40 }
  })
end, { desc = "telescope file_browser" })
