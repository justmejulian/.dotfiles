return {
  {
    'folke/which-key.nvim',
    event = 'VeryLazy',
    opts = {
      spec = {
        { '<leader>c', group = '[C]ode', mode = { 'n', 'x' } },
        { '<leader>cl', group = '[L]ogs', mode = { 'n', 'x' } },
        -- { '<leader>d', group = '[D]ocument' },
        { '<leader>t', group = '[T]oggle' },
        { '<leader>g', group = '[G]it', mode = { 'n', 'v' } },
        { '<leader>gd', group = '[G]it [D]iff', mode = { 'n', 'v' } },
        { '<leader>n', group = '[N]eovim' },
        { '<leader>d', group = '[D]iagnostics' },
        { '<leader>s', group = '[S]ymbols', mode = { 'n', 'v' } },
      },
    },
    keys = {
      {
        '<leader><leader>',
        function()
          require('which-key').show { global = false }
        end,
        desc = 'Buffer Local Keymaps (which-key)',
      },
    },
  },
}
