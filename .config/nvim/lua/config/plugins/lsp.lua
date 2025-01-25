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
      ensure_installed = { "lua_ls", "bashls", "vtsls" },
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
    end,
    import = "config.plugins.lsp.typescript"
  }
}
