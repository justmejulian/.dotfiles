"""Validate the local Atlas options without loading plugins or making worktrees."""
from pathlib import Path
import shutil
import subprocess
import unittest


CONFIG = Path.home() / ".config/nvim/lua/config/plugins/atlas.lua"
LUA = r'''
local pid = 123
vim = {
  fn = { getpid = function() return pid end },
  fs = { basename = function(path)
    return (path:gsub('/+$', ''):match('([^/]+)$') or '')
  end },
}
local config = dofile(arg[1])
local diff = config.opts.pulls.diff
assert(diff.open_cmd == 'CodeDiff')
assert(diff.lsp.enabled == true)
assert(#diff.lsp.link == 1 and diff.lsp.link[1] == 'node_modules')
local dir = diff.lsp.dir
local root = '/Users/julianvisser/.herdr/worktrees/app/atlas/'
local context = { repo_full_name = 'owner/repo', pr_id = 42, repo_root = '/source/checkout', head_sha = 'abcdef1234567890' }
local first = dir(context)
assert(first == root .. 'owner/repo/pr-42/nvim-123', first)
pid = 456
assert(dir(context) == root .. 'owner/repo/pr-42/nvim-456')
assert(first ~= dir(context))
context.pr_id = nil
assert(dir(context) == root .. 'owner/repo/head-abcdef123456/nvim-456')
context.pr_id = ''
assert(dir(context) == root .. 'owner/repo/head-abcdef123456/nvim-456')
context.repo_full_name = nil
assert(dir(context) == root .. 'local/checkout/head-abcdef123456/nvim-456')
for _, context in ipairs({
  {},
  { repo_full_name = '../../..', pr_id = '../../escape', head_sha = '../bad' },
  { repo_full_name = 'a b/c$d', pr_id = '42/../oops' },
  { repo_root = '/', pr_id = '..' },
}) do
  local path = dir(context)
  assert(path:sub(1, #root) == root, path)
  local suffix = path:sub(#root + 1)
  assert(suffix:match('^[%w_-]+/[%w_-]+/[%w_-]+/nvim%-456$'), path)
  assert(not suffix:find('%.%.'), path)
end
print('Atlas options, safe disposable paths, PID isolation and fallback verified')
'''


class AtlasConfigTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("luajit"), "LuaJIT unavailable; no dependencies installed")
    def test_options_and_disposable_worktree_paths(self):
        result = subprocess.run(["luajit", "-", str(CONFIG)], input=LUA, text=True,
                                capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
