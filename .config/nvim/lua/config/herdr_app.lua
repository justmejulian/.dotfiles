-- Herdr app: keep the tab's nvim in the same folder as the tab's agent.
-- herdr-nvim starts one nvim per tab at the git root of whatever terminal had
-- focus, and leaves it there. This follows the agent instead, whenever nvim
-- starts or gets focus (Cmd+E).

local tab = vim.env.HERDR_NVIM_HOST == 'app' and (vim.env.HERDR_TAB_ID or ''):match ':(.+)$'
if not tab then
  return
end

local function decode(out)
  local ok, decoded = pcall(vim.json.decode, out.code == 0 and out.stdout or '')
  return ok and decoded or nil
end

-- The folder the tab's agent runs in (its program's, not its shell's).
local function agent_cwd(callback)
  vim.system({ 'hc', 'ls', '--json', '--label', 'herdr.tab=' .. tab }, { text = true }, function(out)
    local listed = decode(out)
    for _, t in ipairs(listed and listed.terminals or {}) do
      if t.status then
        vim.system({ 'hc', 'get', t.address, '--json' }, { text = true }, function(got)
          local info = decode(got) or {}
          callback((info.foreground or {}).cwd or info.cwd or t.cwd)
        end)
        return
      end
    end
  end)
end

local function follow_agent()
  agent_cwd(vim.schedule_wrap(function(cwd)
    if cwd and vim.fn.isdirectory(cwd) == 1 and cwd ~= vim.fn.getcwd() then
      vim.cmd.cd(vim.fn.fnameescape(cwd))
    end
  end))
end

vim.api.nvim_create_autocmd({ 'VimEnter', 'FocusGained' }, {
  group = vim.api.nvim_create_augroup('herdr_app_follow_agent', {}),
  callback = follow_agent,
})
