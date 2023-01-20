local status, telescope = pcall(require, "telescope")
if (not status) then return end
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

vim.keymap.set("n", "<Leader>fe", function()
  telescope.extensions.file_browser.file_browser({
    path = "%:p:h",
    cwd = telescope_buffer_dir(),
    respect_gitignore = false,
    hidden = true,
    grouped = true,
    initial_mode = "normal",
  })
end, { desc = "telescope file_browser" })

vim.keymap.set('n', '<Leader>fg', builtin.live_grep, { desc = "telescope live_grep" })
vim.keymap.set('n', '<Leader>fs', builtin.grep_string, { desc = "telescope find string under cursor" })

vim.keymap.set('n', '<Leader>fb', builtin.buffers, { desc = "telescope buffers" })
vim.keymap.set('n', '<Leader>fh', builtin.help_tags, { desc = "telescope help_tags" })
vim.keymap.set('n', '<Leader>fd', builtin.diagnostics, { desc = "telescope diagnostics" })

vim.keymap.set('n', '<Leader>fi', builtin.lsp_implementations, { desc = "telescope lsp_implementations" })

vim.keymap.set('n', '<Leader>gs', builtin.git_status, { desc = "telescope git status" })
vim.keymap.set('n', 'gr', builtin.lsp_references, { desc = "telescope lsp_references" })
