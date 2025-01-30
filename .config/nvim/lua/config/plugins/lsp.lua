return {
  {
    "williamboman/mason.nvim",
    cmd = "Mason",
    keys = { { "<leader>m", "<cmd>Mason<cr>", desc = "Mason" } },
    build = ":MasonUpdate",
    opts = {}
  },
  {
    "williamboman/mason-lspconfig.nvim",
    opts = {
      -- todo: move this onto lsp lang imports
      ensure_installed = { "lua_ls", "bashls", "vtsls", "tinymist" },
    }
  },
  {
    "folke/lazydev.nvim",
    ft = "lua",
    opts = {
      library = {
        { path = "${3rd}/luv/library", words = { "vim%.uv" } },
      },
    },
  },
  {
    "neovim/nvim-lspconfig",
    config = function()
      local capabilities = require('blink.cmp').get_lsp_capabilities()
      local lspconfig = require("lspconfig")
      require('config.plugins.lsp.lua').setup(lspconfig, capabilities)
      require('config.plugins.lsp.bash').setup(lspconfig, capabilities)
      require('config.plugins.lsp.typst').setup(lspconfig, capabilities)
      require('config.plugins.lsp.typescript').setup(lspconfig, capabilities)
      require('config.plugins.lsp.ember').setup(lspconfig, capabilities)
    end,
    keys = {
      { 'gD',         vim.lsp.buf.declaration,                                     desc = "lsp declaration" },
      { 'gd',         function() vim.lsp.buf.definition { on_list = on_list } end, desc = "lsp definition" },
      { 'K',          vim.lsp.buf.hover,                                           desc = "lsp hover" },
      { '<C-k>',      vim.lsp.buf.signature_help,                                  desc = "lsp signature_help" },
      { '<leader>ca', vim.lsp.buf.code_action,                                     desc = "lsp code_action" },
      { '<leader>f',  function() vim.lsp.buf.format { async = true } end,          desc = "lsp format" },
      { ';df',        function() vim.lsp.buf.format { async = true } end,          desc = "lsp format" },
      { '<leader>dn', vim.diagnostic.goto_next,                                    { desc = "diagnostic next" } },
      { '<leader>dp', vim.diagnostic.goto_prev,                                    { desc = "diagnostic prev" } },
      { '<leader>df', vim.diagnostic.open_float,                                   { desc = "diagnostic float" } },
    }
  }
}
