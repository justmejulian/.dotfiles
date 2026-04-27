local util      = require 'revu.util'
local parse     = require 'revu.parse'
local highlight = require 'revu.highlight'

local M = {}

M.setup_highlight = highlight.setup

function M.search()
  local repo_root = util.get_repo_root()
  if not repo_root then
    vim.notify('revu: not in git repo', vim.log.levels.ERROR)
    return
  end

  local output = vim.fn.system 'revu comments 2>&1'
  if vim.v.shell_error ~= 0 then
    vim.notify('revu: ' .. vim.trim(output), vim.log.levels.ERROR)
    return
  end

  local threads = parse.parse_comments(output)
  if #threads == 0 then
    vim.notify('revu: no comments', vim.log.levels.INFO)
    return
  end

  local items = {}
  for _, t in ipairs(threads) do
    local preview = t.lines[1] or ''
    table.insert(items, {
      text = string.format('[%s] %s:%d  %s', t.id or '?', t.path, t.lnum, preview),
      file = repo_root .. t.path,
      pos  = { t.lnum, 0 },
    })
  end

  Snacks.picker {
    title  = 'PR Comments',
    items  = items,
    format = 'text',
  }
end

function M.clean()
  local root = util.get_repo_root()
  if not root then
    vim.notify('revu: not in git repo', vim.log.levels.ERROR)
    return
  end

  vim.notify('revu: removing injected comments…', vim.log.levels.INFO)
  vim.fn.jobstart('revu sync --clean', {
    cwd = root,
    on_exit = function(_, code)
      vim.schedule(function()
        if code == 0 then
          vim.cmd 'checktime'
          vim.notify('revu: done', vim.log.levels.INFO)
        else
          vim.notify('revu sync --clean failed (exit ' .. code .. ')', vim.log.levels.ERROR)
        end
      end)
    end,
    on_stderr = function(_, data)
      if data and data[1] ~= '' then
        vim.schedule(function()
          vim.notify('revu: ' .. table.concat(data, '\n'), vim.log.levels.WARN)
        end)
      end
    end,
  })
end

function M.add()
  local bufnr = vim.api.nvim_get_current_buf()
  local row = vim.api.nvim_win_get_cursor(0)[1]
  local prefix = util.get_prefix(bufnr)
  local current_line = vim.api.nvim_buf_get_lines(bufnr, row - 1, row, false)[1] or ''
  local indent = current_line:match '^(%s*)'
  local on_revu_line = current_line:find 'REVU%[' ~= nil

  vim.ui.input({ prompt = 'PR comment: ' }, function(text)
    if not text or text == '' then
      return
    end
    local comment = indent .. prefix .. ' REVU[NEW] ' .. text
    -- On an existing REVU line: insert below. Otherwise: insert above.
    local insert_at = on_revu_line and row or row - 1
    vim.api.nvim_buf_set_lines(bufnr, insert_at, insert_at, false, { comment })
  end)
end

return M
