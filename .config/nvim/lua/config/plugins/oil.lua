return {
  {
    'stevearc/oil.nvim',
    opts = {
      view_options = {
        show_hidden = false,
      },
      keymaps = {
        ["<CR>"] = { "actions.select", opts = { close = true } },
        ["<C-v>"] = { "actions.select", opts = { vertical = true, close = true } },
      },
    },
    dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function()
      require("oil").setup({
        float = {
          -- max_width and max_height can be integers or a float between 0 and 1 (e.g. 0.4 for 40%)
          max_width = 0.8,
          max_height = 0.8,
          preview_split = "right",
        },
      })
    end,
    keys = {
      {
        ";e",
        function()
          require('oil').open_float()
          require('oil.util').run_after_load(0, function()
            require('oil').open_preview()
          end)
        end,
        desc = "Explore"
      },
    },
  }
}
