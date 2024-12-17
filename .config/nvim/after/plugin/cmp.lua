local status, cmp = pcall(require, "cmp")
if (not status or not cmp) then return end
local lspkind = require 'lspkind'
local luasnip = require "luasnip"

cmp.setup({
  snippet = {
    expand = function(args)
      luasnip.lsp_expand(args.body)
    end,
  },
  mapping = cmp.mapping.preset.insert({
    ["<C-k>"] = cmp.mapping.select_prev_item(),
    ["<C-j>"] = cmp.mapping.select_next_item(),
    ['<C-e>'] = cmp.mapping.close(),
    ['<Enter>'] = cmp.mapping.confirm({
      select = true,
    }),
  }),
  window = {
    documentation = cmp.config.window.bordered(),
  },
  sources = cmp.config.sources({
    { name = "cmp-dbee" },
    { name = 'luasnip' },
    { name = 'nvim_lsp' },
    { name = "nvim_lua" },
    { name = 'buffer' },
    { name = 'nvim_lsp_signature_help' },
    { name = "copilot", group_index = 2 },
  }),
  formatting = {
    format = lspkind.cmp_format({ with_text = false, maxwidth = 50 })
  }
})

vim.cmd [[
  set completeopt=menuone,noinsert,noselect
  highlight! default link CmpItemKind CmpItemMenuDefault
]]
