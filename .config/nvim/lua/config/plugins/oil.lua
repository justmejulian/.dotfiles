function _G.get_oil_winbar()
  local bufnr = vim.api.nvim_win_get_buf(vim.g.statusline_winid)
  local dir = require('oil').get_current_dir(bufnr)
  if dir then
    return vim.fn.fnamemodify(dir, ':~')
  else
    -- If there is no current directory (e.g. over ssh), just show the buffer name
    return vim.api.nvim_buf_get_name(0)
  end
end

local function copy_paths()
  local oil = require 'oil'
  local dir = oil.get_current_dir()
  if not dir then
    return
  end

  local first, last = vim.fn.line '.', vim.fn.line '.'
  local mode = vim.fn.mode()
  local visual = mode == 'v' or mode == 'V' or mode == '\22'
  if visual then
    first = vim.fn.line 'v'
  end

  local paths = {}
  for line = math.min(first, last), math.max(first, last) do
    local entry = oil.get_entry_on_line(0, line)
    if entry then
      paths[#paths + 1] = dir .. entry.name .. (entry.type == 'directory' and '/' or '')
    end
  end
  if #paths > 0 then
    vim.fn.setreg('+', table.concat(paths, '\n'), 'v')
  end
  if visual then
    vim.cmd.normal { args = { vim.keycode '<Esc>' }, bang = true }
  end
end

return {
  'stevearc/oil.nvim',
  lazy = false,
  priority = 100, -- not needed but can help load faster
  dependencies = { 'nvim-tree/nvim-web-devicons', 'folke/snacks.nvim' },
  opts = {
    default_file_explorer = true,
    view_options = {
      show_hidden = true,
    },
    win_options = {
      winbar = '%!v:lua.get_oil_winbar()',
    },
    keymaps = {
      ['<D-c>'] = { callback = copy_paths, mode = { 'n', 'x' }, desc = 'Copy file paths to clipboard' },
      ['<CR>'] = { 'actions.select', opts = { close = true } },
      ['<C-v>'] = { 'actions.select', opts = { vertical = true, close = true } },
      ['<C-h>'] = false,
    },
    float = {
      -- max_width and max_height can be integers or a float between 0 and 1 (e.g. 0.4 for 40%)
      max_width = 0.8,
      max_height = 0.8,
      preview_split = 'right',
    },
  },
  keys = {
    {
      ';e',
      '<cmd>Oil<cr>',
      desc = 'Explore',
    },
    {
      ';ns',
      '<cmd>Oil~/.local/state/nvim/swap <cr>',
      desc = 'Open NVIM [s]wap',
    },
  },
}
