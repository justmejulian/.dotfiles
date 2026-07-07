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

      local ensure_installed = vim.tbl_filter(function(name)
        local server = opts.servers[name]
        return not server.disable_auto_install
      end, vim.tbl_keys(opts.servers))

      mason_lspconfig.setup {
        ensure_installed = ensure_installed,
        automatic_enable = false,
      }

      local capabilities = require('blink.cmp').get_lsp_capabilities()
      local lspconfig = require 'lspconfig'
      for name, server in pairs(opts.servers) do
        -- fidget.notify('Setting up LSP ' .. name)
        vim.lsp.enable(name)
        local config = { capabilities = capabilities }
        if server.settings then
          config.settings = server.settings
        end
        if server.filetypes then
          config.filetypes = server.filetypes
        end
        vim.lsp.config(name, config)
        if server.post_setup ~= nil then
          server.post_setup()
        end
      end

      -- Show LSP progress in Ghostty terminal progress bar (OSC 9;4)
      local active_tokens = {}
      vim.api.nvim_create_autocmd('LspProgress', {
        callback = function(ev)
          local value = ev.data and ev.data.params and ev.data.params.value
          if not value then
            return
          end
          local token = tostring(ev.data.params.token)
          if value.kind == 'begin' then
            active_tokens[token] = true
            io.write '\027]9;4;3;0\027\\'
            io.flush()
          elseif value.kind == 'end' then
            active_tokens[token] = nil
            if not next(active_tokens) then
              io.write '\027]9;4;0;0\027\\'
              io.flush()
            end
          end
        end,
      })
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
      -- {
      --   '<leader>ca',
      --   vim.lsp.buf.code_action,
      --   desc = 'lsp code_action',
      -- },
      {
        '<leader>f',
        function()
          vim.lsp.buf.format { async = true }
        end,
        desc = 'lsp format',
      },
      {
        '<leader>dn',
        function()
          vim.diagnostic.jump { count = 1, float = true }
        end,
        desc = 'diagnostic next',
      },
      {
        '<leader>dp',
        function()
          vim.diagnostic.jump { count = -1, float = true }
        end,
        desc = 'diagnostic prev',
      },
      { '<leader>df', vim.diagnostic.open_float, desc = 'diagnostic float' },
    },
  },
  {
    'rachartier/tiny-code-action.nvim',
    dependencies = { 'folke/snacks.nvim' },
    event = 'LspAttach',
    opts = {
      picker = 'snacks',
    },
    keys = {
      {
        '<leader>ca',
        function()
          require('tiny-code-action').code_action {}
        end,
        desc = 'lsp code action',
      },
    },
  },
}
