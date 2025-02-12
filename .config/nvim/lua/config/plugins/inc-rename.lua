return {
  "smjonas/inc-rename.nvim",
  opts = {},
  keys = {
    {
      "<leader>rn",
      function()
        return ":IncRename " .. vim.fn.expand("<cword>")
      end,
      desc = '[R]e[n]ame'
    }
  }
}
