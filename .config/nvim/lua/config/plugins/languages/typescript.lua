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
    opts = { languages = { 'javascript', 'typescript', 'tsx' } },
  },
  {
    'Sebastian-Nielsen/better-type-hover',
    ft = { 'typescript', 'typescriptreact', 'javascript', 'javascriptreact' },
    opts = {
      openTypeDocKeymap = '<S-K>',
    },
  },
  {
    'nemanjamalesija/ts-expand-hover.nvim',
    ft = { 'typescript', 'typescriptreact', 'javascript', 'javascriptreact' },
    main = 'ts_expand_hover',
    opts = {
      keymaps = {
        hover = 'K',
        expand = '+',
        collapse = '-',
        close = { 'q', '<Esc>' },
      },
      float = {
        border = 'rounded',
        max_width = 80,
        max_height = 30,
      },
    },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        vtsls = {
          filetypes = { 'javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'vue' },
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
              tsserver = {
                globalPlugins = {
                  {
                    name = '@vue/typescript-plugin',
                    location = vim.fn.expand '~/.local/share/nvim/mason/packages/vue-language-server/node_modules/@vue/typescript-plugin',
                    languages = { 'vue' },
                    configNamespace = 'typescript',
                    enableForWorkspaceTypeScriptVersions = true,
                  },
                },
              },
            },
            typescript = js_ts_settings,
            javascript = js_ts_settings,
          },

          post_setup = function() end,
        },
      },
    },
  },
}
