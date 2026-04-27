local M = {}

local ns = vim.api.nvim_create_namespace 'revu'
local timers = {}

local hl = {
  RevuNew  = { fg = '#ff9e64', bg = '#3b2a1a', bold = true },
  RevuId   = { fg = '#7aa2f7', bg = '#1a2340', bold = true },
  RevuText = { fg = '#9ece6a', bg = '#1e2d16' },
}

local function set_hl_defaults()
  for name, opts in pairs(hl) do
    vim.api.nvim_set_hl(0, name, opts)
  end
end

local function highlight_buf(bufnr)
  if not vim.api.nvim_buf_is_valid(bufnr) then
    return
  end
  vim.api.nvim_buf_clear_namespace(bufnr, ns, 0, -1)
  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
  for i, line in ipairs(lines) do
    local s, e, id = line:find 'REVU%[([^%]]+)%]'
    if s then
      vim.api.nvim_buf_set_extmark(bufnr, ns, i - 1, s - 1, {
        end_col = e,
        hl_group = id == 'NEW' and 'RevuNew' or 'RevuId',
      })
      if e < #line then
        vim.api.nvim_buf_set_extmark(bufnr, ns, i - 1, e, {
          end_col = #line,
          hl_group = 'RevuText',
        })
      end
    end
  end
end

local function schedule_highlight(bufnr)
  if timers[bufnr] then
    timers[bufnr]:stop()
    timers[bufnr] = nil
  end
  timers[bufnr] = vim.defer_fn(function()
    timers[bufnr] = nil
    highlight_buf(bufnr)
  end, 80)
end

function M.setup()
  set_hl_defaults()

  local group = vim.api.nvim_create_augroup('revu_highlight', { clear = true })

  vim.api.nvim_create_autocmd({ 'BufEnter', 'BufWritePost' }, {
    group = group,
    callback = function(ev)
      highlight_buf(ev.buf)
    end,
  })

  vim.api.nvim_create_autocmd({ 'TextChanged', 'TextChangedI' }, {
    group = group,
    callback = function(ev)
      schedule_highlight(ev.buf)
    end,
  })

  -- Re-apply after colorscheme change (highlights reset on colorscheme load)
  vim.api.nvim_create_autocmd('ColorScheme', {
    group = group,
    callback = set_hl_defaults,
  })
end

return M
