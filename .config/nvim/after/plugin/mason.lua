local status, mason = pcall(require, "mason")
if (not status) then return end
local status2, masonLspconfig = pcall(require, "mason-lspconfig")
if (not status2) then return end
local status3, lspconfig = pcall(require, "lspconfig")
if (not status3) then return end

-- Use an on_attach function to only map the following keys
-- after the language server attaches to the current buffer
local on_attach = function(client, bufnr)
  -- Enable completion triggered by <c-x><c-o>
  vim.api.nvim_buf_set_option(bufnr, 'omnifunc', 'v:lua.vim.lsp.omnifunc')

  -- Filter out ts reat FC type as definition
  local function filter(arr, fn)
    if type(arr) ~= "table" then
      return arr
    end

    local filtered = {}
    for k, v in pairs(arr) do
      if fn(v, k, arr) then
        table.insert(filtered, v)
      end
    end

    return filtered
  end

  local function filterReactDTS(value)
    return string.match(value.filename, 'react/index.d.ts') == nil
  end

  local function on_list(options)
    -- https://github.com/typescript-language-server/typescript-language-server/issues/216
    local items = options.items
    if #items > 1 then
      items = filter(items, filterReactDTS)
    end

    vim.fn.setqflist({}, ' ', { title = options.title, items = items, context = options.context })
    vim.api.nvim_command('cfirst')
  end

  -----------

  -- Mappings.
  -- See `:help vim.lsp.*` for documentation on any of the below functions
  -- local bufopts = { noremap = true, silent = true, buffer = bufnr }
  vim.keymap.set('n', 'gD', vim.lsp.buf.declaration, { desc = "lsp declaration" })
  vim.keymap.set('n', 'gd', function() vim.lsp.buf.definition { on_list = on_list } end, { desc = "lsp definition" })
  vim.keymap.set('n', 'K', vim.lsp.buf.hover, { desc = "lsp hover" })
  vim.keymap.set('n', '<C-k>', vim.lsp.buf.signature_help, { desc = "lsp signature_help" })
  vim.keymap.set('n', '<space>ca', vim.lsp.buf.code_action, { desc = "lsp code_action" })
  vim.keymap.set('n', '<space>p', function() vim.lsp.buf.format { async = true } end, { desc = "lsp format" })
  -- some key maps defined in telescope
end

-- Set up completion using nvim_cmp with LSP source
local capabilities = require("cmp_nvim_lsp").default_capabilities()

masonLspconfig.setup_handlers {
  -- This is a default handler that will be called for each installed server (also for new servers that are installed during a session)
  function(server_name)
    lspconfig[server_name].setup {
      on_attach = on_attach,
      capabilities = capabilities,
    }
  end,

  -- You can also override the default handler for specific servers by providing them as keys, like so:
  ["sumneko_lua"] = function()
    lspconfig.sumneko_lua.setup({
      on_attach = on_attach,
      capabilities = capabilities,
      settings = {
        Lua = {
          -- Tells Lua that a global variable named vim exists to not have warnings when configuring neovim
          diagnostics = {
            globals = { "vim" },
          },
          workspace = {
            -- Make the server aware of Neovim runtime files
            library = vim.api.nvim_get_runtime_file("", true),
            checkThirdParty = false
          },
        },
      },
    })
  end,
}

mason.setup({})

masonLspconfig.setup {
  ensure_installed = { "sumneko_lua", "tsserver", "eslint", "cssls", "html", "pylsp", "tailwindcss" },
  automatic_installation = true,
}

vim.keymap.set('n', '<Leader>m', '<Cmd>Mason<CR>', { desc = "Mason" })



local status4, null_ls = pcall(require, "null-ls")
local status5, mason_null_ls = pcall(require, "mason-null-ls")
if not status4 or not status5 then
  return
end

mason_null_ls.setup({
  ensure_installed = { 'jq', 'prettierd', 'markdownlint' },
  automatic_installation = true,
  automatic_setup = true,
})

-- will setup any installed and configured sources above
null_ls.setup()

mason_null_ls.setup_handlers({})
