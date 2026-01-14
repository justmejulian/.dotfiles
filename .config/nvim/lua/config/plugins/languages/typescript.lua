local js_ts_settings = {
  updateImportsOnFileMove = { enabled = 'always' },
  suggest = {
    completeFunctionCalls = true,
  },
  inlayHints = {
    enumMemberValues = { enabled = true },
    functionLikeReturnTypes = { enabled = true },
    parameterNames = { enabled = 'literals' },
    parameterTypes = { enabled = true },
    propertyDeclarationTypes = { enabled = true },
    variableTypes = { enabled = false },
  },
}

return {
  {
    'stevearc/conform.nvim',
    opts = { formatters_by_ft = {
      javascript = { 'prettierd' },
      typescript = { 'prettierd' },
    } },
  },
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'javascript', 'typescript' } },
  },
  {
    'Sebastian-Nielsen/better-type-hover',
    ft = { 'typescript', 'typescriptreact', 'javascript', 'javascriptreact' },
    opts = {
      openTypeDocKeymap = '<S-K>',
    },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        vtsls = {
          -- https://github.com/yioneko/vtsls/blob/main/packages/service/configuration.schema.json
          settings = {
            vtsls = {
              enableMoveToFileCodeAction = true,
              autoUseWorkspaceTsdk = true,
              experimental = {
                maxInlayHintLength = 30,
                completion = {
                  enableServerSideFuzzyMatch = true,
                },
              },
            },
            typescript = js_ts_settings,
            javascript = js_ts_settings,
          },

          post_setup = function()
            local fidget = require 'fidget'
            fidget.notify 'Running post setup for typescript'
            -- vim.lsp.inlay_hint.enable(true)
          end,
        },
      },
    },
  },
}
