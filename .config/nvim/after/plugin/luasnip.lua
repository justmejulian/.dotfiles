local status, luasnip = pcall(require, "luasnip")
if (not status) then return end

-- this will expand the current item or jump to the next item within the snippet.
vim.keymap.set({ "i", "s" }, "<C-n>", function()
  if luasnip.jumpable(1) then
    luasnip.jump(1)
  end
end, { silent = true })

-- this always moves to the previous item within the snippet
vim.keymap.set({ "i", "s" }, "<C-p>", function()
  if luasnip.jumpable(-1) then
    luasnip.jump(-1)
  end
end, { silent = true })

-- Load snippets
require("luasnip.loaders.from_vscode").lazy_load()
