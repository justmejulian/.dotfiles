return {
  {
    'stevearc/conform.nvim',
    opts = { formatters_by_ft = { python = { 'ruff_organize_imports', 'ruff_format' } } },
  },
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'python' } },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        pyright = {
          settings = {
            python = {
              pythonPath = '.venv/bin/python',
            },
            pyright = {
              disableOrganizeImports = true,
            },
          },
          post_setup = function() end,
        },
        ruff = {
          post_setup = function() end,
        },
      },
    },
  },
}
