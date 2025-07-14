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
              experimental = {
                maxInlayHintLength = 30,
              },
            },
            typescript = js_ts_settings,
            javascript = js_ts_settings,
          },

          post_setup = function()
            vim.lsp.inlay_hint.enable(true)
          end,
        },
      },
    },
  },
}
