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
    opts_extend = { 'languages' }, -- extend not merge
    opts = {
        languages = {},
    },
    config = function(_, opts)
      require('mason-lspconfig').setup({ ensure_installed = opts.languages })
    end
  },
  {
    "neovim/nvim-lspconfig",
    lazy = false,
    opts = { servers = {} },
    config = function(_, opts)
      local capabilities = require('blink.cmp').get_lsp_capabilities()
      local lspconfig = require("lspconfig")
      for name, server in pairs(opts.servers) do
        lspconfig[name].setup({ capabilities })
        if server.post_setup ~= nil then
        vim.print(name)
          server.post_setup()
        end
      end
    end,
    keys = {
      {
        'gD',
        vim.lsp.buf.declaration,
        desc = "lsp declaration"
      },
      {
        'gd',
        function() vim.lsp.buf.definition { on_list = on_list } end,
        desc = "lsp definition"
      },
      {
        'K',
        vim.lsp.buf.hover,
        desc = "lsp hover"
      },
      {
        '<C-k>',
        vim.lsp.buf.signature_help,
        desc = "lsp signature_help"
      },
      {
        '<leader>ca',
        vim.lsp.buf.code_action,
        desc = "lsp code_action"
      },
      {
        '<leader>f',
        function() vim.lsp.buf.format { async = true } end,
        desc = "lsp format"
      },
      {
        ';df',
        function() vim.lsp.buf.format { async = true } end,
        desc = "lsp format"
      },
      { '<leader>dn', vim.diagnostic.goto_next,  { desc = "diagnostic next" } },
      { '<leader>dp', vim.diagnostic.goto_prev,  { desc = "diagnostic prev" } },
      { '<leader>df', vim.diagnostic.open_float, { desc = "diagnostic float" } },
    }
  }
}
