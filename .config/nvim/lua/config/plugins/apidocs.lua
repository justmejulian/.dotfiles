-- devdocs
return {
  {
    'emmanueltouzery/apidocs.nvim',
    dependencies = {
      'nvim-treesitter/nvim-treesitter',
      'folke/snacks.nvim',
    },
    cmd = { 'ApidocsSearch', 'ApidocsInstall', 'ApidocsOpen', 'ApidocsSelect', 'ApidocsUninstall' },
    config = function()
      require('apidocs').setup()
      -- Picker will be auto-detected. To select a picker of your choice explicitly you can set picker by the configuration option 'picker':
      -- require('apidocs').setup({picker = "snacks"})
      -- Possible options are 'ui_select', 'telescope', and 'snacks'
    end,
    keys = {
      { ';dd', '<cmd>ApidocsOpen<cr>', desc = 'Search Api Doc' },
      {
        ';df',
        function()
          local filetype = vim.bo.filetype
          require('apidocs').apidocs_search { restrict_sources = { filetype } }
        end,
        desc = 'Search Api Doc for current file type',
      },
    },
  },
}
