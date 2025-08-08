local path = require 'utils.path'
local case = require 'utils.case'

return {
  {
    'folke/snacks.nvim',
  },
  {
    -- dir = '/Users/julianvisser/Documents/git/private/ember.nvim',
    'justmejulian/ember.nvim',
    opts = {
      picker = 'snacks.picker',
    },
    keys = {
      {
        '<leader>cr',
        function()
          require('ember').get_related_files()
        end,
        desc = 'Select [R]elated Files',
      },
      {
        'gR',
        function()
          require('ember').get_kind_usages()
        end,
        desc = 'get [R]eferenced Files',
      },
    },
  },
  {
    'stevearc/conform.nvim',
    opts = {
      formatters_by_ft = {
        javascript = { 'prettierd' },
        typescript = { 'prettierd' },
        html = { 'prettierd' },
        css = { 'prettierd' },
        glimmer = { 'prettierd' },
      },
    },
  },
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'javascript', 'typescript', 'html', 'css', 'glimmer' } },
  },
  {
    'neovim/nvim-lspconfig',
    opts = {
      servers = {
        ember = {
          post_setup = function() end,
        },
        -- glint = {
        --   disable_auto_install = true,
        --   post_setup = function() end,
        -- },
      },
    },
  },
}
