return {
  'stevearc/oil.nvim',
  lazy = false,
  priority = 100, -- not needed but can help load faster
  dependencies = { "nvim-tree/nvim-web-devicons" },
  opts = {
    default_file_explorer = true,
    view_options = {
      show_hidden = true,
    },
    keymaps = {
      ["<CR>"] = { "actions.select", opts = { close = true } },
      ["<C-v>"] = { "actions.select", opts = { vertical = true, close = true } },
    },
    float = {
      -- max_width and max_height can be integers or a float between 0 and 1 (e.g. 0.4 for 40%)
      max_width = 0.8,
      max_height = 0.8,
      preview_split = "right",
    },
  },
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
