function createFormatOnSaveAutocmd()
  vim.api.nvim_create_autocmd('LspAttach', {
    callback = function(args)
      local c = vim.lsp.get_client_by_id(args.data.client_id)
      if not c then return end
      if vim.bo.filetype == "lua" then
        -- Format the current buffer on save
        vim.api.nvim_create_autocmd('BufWritePre', {
          buffer = args.buf,
          callback = function()
            vim.lsp.buf.format({ bufnr = args.buf, id = c.id })
          end,
        })
      end
    end
  })
end

return {
  {
    'nvim-treesitter/nvim-treesitter',
    opts = { languages = { 'lua' } },
  },
  {
    'williamboman/mason-lspconfig.nvim',
    dependencies = {
      "williamboman/mason.nvim",
    },
    opts = { languages = { 'lua_ls' } },
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
    opts = {
      servers = {
        lua_ls = {
          post_setup = function()
            createFormatOnSaveAutocmd()
          end
        }
      }
    }
  }
}
