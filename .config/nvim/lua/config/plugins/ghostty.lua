return {
  dir = (vim.env.GHOSTTY_RESOURCES_DIR or "") .. "/../nvim/site",
  lazy = false,
  name = "ghostty",
  cond = vim.env.GHOSTTY_RESOURCES_DIR ~= nil,
  config = function()
    -- Set the title of the terminal window
    if vim.fn.getenv("TERM_PROGRAM") == "ghostty" then
      vim.opt.title = true
      vim.opt.titlestring = "nvim %{fnamemodify(getcwd(), ':t')}"
    end
  end,
}
