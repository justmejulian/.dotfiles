local status, inc_rename = pcall(require, "inc_rename")
if (not status) then return end

inc_rename.setup()

vim.keymap.set("n", "<leader>rn", function()
  return ":IncRename " .. vim.fn.expand("<cword>")
end, { expr = true })
