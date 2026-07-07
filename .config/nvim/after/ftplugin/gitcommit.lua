local function insert_jira_id()
  local branch = vim.fn.system("git branch --show-current 2>/dev/null"):gsub("\n", "")
  local jira_id = branch:match("([A-Z]+-[0-9]+)")
  if not jira_id then
    vim.notify("No Jira ID in branch: " .. branch, vim.log.levels.WARN)
    return
  end
  local row, col = unpack(vim.api.nvim_win_get_cursor(0))
  local line = vim.api.nvim_get_current_line()
  local new_line = line:sub(1, col) .. jira_id .. " " .. line:sub(col + 1)
  vim.api.nvim_set_current_line(new_line)
  vim.api.nvim_win_set_cursor(0, { row, col + #jira_id + 1 })
end

vim.keymap.set("n", "<leader>ji", insert_jira_id, { buffer = true, desc = "[J]ira [I]nsert ID" })
vim.keymap.set("i", "<C-j>", insert_jira_id, { buffer = true, desc = "Insert Jira ID" })
