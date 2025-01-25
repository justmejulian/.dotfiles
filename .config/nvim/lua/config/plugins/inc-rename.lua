return {
  "smjonas/inc-rename.nvim",
  config = function()
    requi("inc_rename").setup({});
    vim.keymap.set("n", "<leader>rn", function()
      return ":IncRename " .. vim.fn.expand("<cword>")
    end, { expr = true })
  end
}
