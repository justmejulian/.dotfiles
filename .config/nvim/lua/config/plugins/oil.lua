return {
  {
    'stevearc/oil.nvim',
    opts = {
      view_options = {
        show_hidden = false,
      }
    },
    dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function ()
      require("oil").setup()
    end
  }
}
