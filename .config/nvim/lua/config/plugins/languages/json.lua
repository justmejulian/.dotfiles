return {
  {
    'stevearc/conform.nvim',
    opts = { formatters_by_ft = { jsonc = { 'prettier' } } },
  },
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'json' } },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        jsonls = {
          settings = {
            json = {
              schemas = {
                {
                  fileMatch = { 'package.json' },
                  name = 'NPM',
                  url = 'https://schemastore.org/package.json',
                },
                {
                  fileMatch = { 'tsconfig.json', 'tsconfig.*.json' },
                  name = 'TypeScript',
                  url = 'https://schemastore.org/tsconfig',
                },
              },
              validate = { enable = true },
            },
          },
          post_setup = function() end,
        },
      },
    },
  },
}
