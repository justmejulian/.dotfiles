-- What this branch changed: the merge-base with origin's default branch compared
-- to the working tree (commits, staged, unstaged and untracked).
local M = {}

local function git(args)
  local result = vim.system(vim.list_extend({ 'git' }, args), { text = true }):wait()
  if result.code ~= 0 then
    return nil
  end
  return vim.trim(result.stdout)
end

function M.root()
  return git { 'rev-parse', '--show-toplevel' }
end

function M.default_branch()
  local head = git { 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD' }
  if head then
    return head
  end
  for _, ref in ipairs { 'origin/main', 'origin/master', 'main' } do
    if git { 'rev-parse', '--verify', '--quiet', ref } then
      return ref
    end
  end
end

function M.merge_base()
  local branch = M.default_branch()
  local sha = branch and git { 'merge-base', branch, 'HEAD' }
  if not sha then
    vim.notify('No merge-base with the default branch', vim.log.levels.WARN)
  end
  return sha
end

-- Paths relative to the git root.
function M.changed_files()
  local root, branch = M.root(), M.default_branch()
  if not (root and branch) then
    return {}
  end
  local seen, files = {}, {}
  local diff = git { '-C', root, 'diff', '--name-only', '--merge-base', branch } or ''
  local untracked = git { '-C', root, 'ls-files', '--others', '--exclude-standard' } or ''
  for _, file in ipairs(vim.split(diff .. '\n' .. untracked, '\n', { trimempty = true })) do
    if not seen[file] then
      seen[file] = true
      files[#files + 1] = file
    end
  end
  return files
end

return M
