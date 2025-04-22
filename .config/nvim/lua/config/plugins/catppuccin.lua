return {
  'catppuccin/nvim',
  name = 'catppuccin',
  priority = 1000,
  opts = {
    flavour = 'mocha',
  },
  -- config is executed when the plugin loaded
  config = function()
    vim.api.nvim_command 'colorscheme catppuccin'
  end,
}
