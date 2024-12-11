local status, neomarks = pcall(require, "neomarks")
if (not status) then return end

neomarks.setup({
  storagefile = vim.fn.stdpath('data') .. "/neomarks.json",
  menu = {
    title = "Neomarks",
    title_pos = "center",
    border = "rounded",
    width = 60,
    height = 10,
  }
})

require("which-key").register({
  [";m"] = {
    name = "Neomarks",
    m = { neomarks.mark_file, "Mark file" },
    n = { neomarks.menu_toggle, "Toggle menu" },
    ["1"] = { function () neomarks.jump_to(1) end, "Jump to mark 1" },
    ["2"] = { function () neomarks.jump_to(2) end, "Jump to mark 2" },
    ["3"] = { function () neomarks.jump_to(3) end, "Jump to mark 3" },
  }
})
-- vim.keymap.set("n",";mn", neomarks.menu_toggle)
-- vim.keymap.set("n",";mm", neomarks.mark_file)
-- vim.keymap.set("n",";m1", function () neomarks.jump_to(1) end)
-- vim.keymap.set("n",";m2", function () neomarks.jump_to(2) end)
-- vim.keymap.set("n",";m3", function () neomarks.jump_to(3) end)
