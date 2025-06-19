return {
  {
    'mason-org/mason.nvim',
  },
  {
    'mason-org/mason-lspconfig.nvim',
  },
  {
    'neovim/nvim-lspconfig',
    lazy = false,
    opts = { servers = {} },
    config = function(_, opts)
      local fidget = require 'fidget'
      -- fidget.notify('Setting up lsp servers' .. vim.inspect(opts.servers))

      local mason = require 'mason'
      local mason_lspconfig = require 'mason-lspconfig'

      mason.setup()

      mason_lspconfig.setup {
        -- automatically install servers set in lspconfig
        ensure_installed = {},
        automatic_installation = true,
      }

      local capabilities = require('blink.cmp').get_lsp_capabilities()
      local lspconfig = require 'lspconfig'
      for name, server in pairs(opts.servers) do
        -- fidget.notify('Setting up LSP ' .. name)
        lspconfig[name].setup { capabilities }
        if server.post_setup ~= nil then
          server.post_setup()
        end
      end
    end,
    keys = {
      {
        'gD',
        vim.lsp.buf.declaration,
        desc = 'lsp declaration',
      },
      -- Handled in snacks.nvim
      -- {
      --   'gd',
      --   function()
      --     vim.lsp.buf.definition { on_list = on_list }
      --   end,
      --   desc = 'lsp definition',
      -- },
      {
        'K',
        vim.lsp.buf.hover,
        desc = 'lsp hover',
      },
      {
        '<C-k>',
        vim.lsp.buf.signature_help,
        desc = 'lsp signature_help',
      },
      {
        '<leader>ca',
        vim.lsp.buf.code_action,
        desc = 'lsp code_action',
      },
      {
        '<leader>f',
        function()
          vim.lsp.buf.format { async = true }
        end,
        desc = 'lsp format',
      },
      {
        ';df',
        function()
          vim.lsp.buf.format { async = true }
        end,
        desc = 'lsp format',
      },
      { '<leader>dn', vim.diagnostic.goto_next, { desc = 'diagnostic next' } },
      { '<leader>dp', vim.diagnostic.goto_prev, { desc = 'diagnostic prev' } },
      { '<leader>df', vim.diagnostic.open_float, { desc = 'diagnostic float' } },
    },
  },
}
