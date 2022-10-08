local status, telescope = pcall(require, "telescope")
if (not status) then return end
local actions = require('telescope.actions')
local builtin = require("telescope.builtin")

local function telescope_buffer_dir()
  return vim.fn.expand('%:p:h')
end

telescope.setup {
  defaults = {
    -- Default configuration for telescope goes here:
    -- config_key = value,
    mappings = {
      n = {
        ['<c-d>'] = require('telescope.actions').delete_buffer
      },
    }
  },
}

telescope.load_extension("file_browser")
vim.keymap.set('n', '<Leader>ff', function()
  builtin.find_files({
    no_ignore = false,
    hidden = true,
    file_ignore_patterns = { "node_modules", ".git" }
  })
end, { desc = "telescope find_files" })
vim.keymap.set('n', '<Leader>fp', function()
  builtin.lsp_definitions({
    jump_type = "never",
  })
end, { desc = "telescope lsp_definitions preview" })
vim.keymap.set('n', '<Leader>fg', function() builtin.live_grep() end, { desc = "telescope live_grep" })
vim.keymap.set('n', '<Leader>fb', function() builtin.buffers() end, { desc = "telescope buffers" })
vim.keymap.set('n', '<Leader>fh', function() builtin.help_tags() end, { desc = "telescope help_tags" })
vim.keymap.set('n', '<Leader>fd', function() builtin.diagnostics() end, { desc = "telescope diagnostics" })
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

vim.keymap.set('n', 'gd', function() builtin.lsp_definitions() end, { desc = "telescope lsp_definitions" })
vim.keymap.set('n', '<Leader>fi', function() builtin.lsp_implementations() end,
  { desc = "telescope lsp_implementations" })
vim.keymap.set('n', 'gr', function() builtin.lsp_references() end, { desc = "telescope lsp_references" })
