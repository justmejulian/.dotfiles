return {
  {
    'stevearc/oil.nvim',
    opts = {
      view_options = {
        show_hidden = false,
      },
      keymaps = {
        ["<CR>"] = { "actions.select", opts = { close = true } },
      },
    },
    dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function ()
      require("oil").setup()
    end
  }
}
