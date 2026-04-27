local M = {}

function M.get_prefix(bufnr)
  local cs = vim.bo[bufnr].commentstring
  if not cs or cs == '' then
    return '//'
  end
  -- commentstring is like "// %s" or "# %s" or "-- %s"
  local prefix = cs:match '^(.-)%s*%%s'
  return vim.trim(prefix or '//') or '//'
end

function M.get_repo_root()
  local result = vim.fn.system 'git rev-parse --show-toplevel 2>/dev/null'
  if vim.v.shell_error ~= 0 then
    return nil
  end
  return vim.trim(result)
end

return M
