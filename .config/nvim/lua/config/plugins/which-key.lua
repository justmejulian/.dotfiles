return {
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts = {
      spec = {
        { '<leader>c', group = '[C]ode',  mode = { 'n', 'x' } },
        -- { '<leader>d', group = '[D]ocument' },
        { '<leader>r', group = '[R]ename' },
        { '<leader>t', group = '[T]oggle' },
        { '<leader>g', group = '[G]it',   mode = { 'n', 'v' } },
        { '<leader>n', group = '[N]eovim' },
      },
    },
    keys = {
      {
        "<leader><leader>",
        function()
          require("which-key").show({ global = false })
        end,
        desc = "Buffer Local Keymaps (which-key)",
      },
    },
  }
}
