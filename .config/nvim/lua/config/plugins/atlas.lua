local function path_component(value)
  local component = tostring(value or ''):gsub('[^%w_-]', '-'):sub(1, 80)
  return component ~= '' and component or 'unknown'
end

local function review_worktree_dir(ctx)
  local owner, repo = (ctx.repo_full_name or ''):match('^([^/]+)/([^/]+)$')
  owner = owner or 'local'
  repo = repo or vim.fs.basename(ctx.repo_root or '')
  local pr = tostring(ctx.pr_id or '')
  local revision = pr ~= '' and ('pr-' .. path_component(pr))
    or ('head-' .. path_component(ctx.head_sha):sub(1, 12))
  return table.concat({
    '/Users/julianvisser/.herdr/worktrees/app/atlas',
    path_component(owner),
    path_component(repo),
    revision,
    'nvim-' .. vim.fn.getpid(),
  }, '/')
end

return {
  'emrearmagan/atlas.nvim',
  cmd = 'Atlas',
  dependencies = { 'nvim-tree/nvim-web-devicons', 'esmuellert/codediff.nvim' },
  opts = {
    ui = { picker = 'snacks' },
    providers = { github = {} },
    keymaps = {
      pulls = {
        review = {
          next_comment = ']r',
          prev_comment = '[r',
          toggle_file_reviewed = '<leader>rv',
        },
      },
    },
    pulls = {
      diff = {
        open_cmd = 'CodeDiff',
        lsp = {
          enabled = true,
          dir = review_worktree_dir,
          link = { 'node_modules' },
        },
      },
      github = {
        views = {
          { name = 'My Pull Requests', key = '1', search = 'is:open author:@me sort:updated-desc' },
          { name = 'Needs My Review', key = '2', search = 'is:open review-requested:@me sort:updated-desc' },
          { name = 'Involved', key = '3', search = 'is:open involves:@me -author:@me sort:updated-desc' },
        },
      },
    },
  },
}
