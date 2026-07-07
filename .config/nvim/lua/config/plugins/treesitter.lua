-- Incremental selection (removed from nvim-treesitter `main`; reimplemented).
local sel = {}
do
  local stack = {}

  local function range_equal(a, b)
    local a1, a2, a3, a4 = a:range()
    local b1, b2, b3, b4 = b:range()
    return a1 == b1 and a2 == b2 and a3 == b3 and a4 == b4
  end

  local function select_node(node)
    local sr, sc, er, ec = node:range()
    vim.fn.setpos("'<", { 0, sr + 1, sc + 1, 0 })
    vim.fn.setpos("'>", { 0, er + 1, math.max(ec, 1), 0 })
    vim.cmd 'normal! gv'
  end

  function sel.init()
    local node = vim.treesitter.get_node()
    if not node then
      return
    end
    stack = { node }
    select_node(node)
  end

  function sel.grow()
    local node = stack[#stack] or vim.treesitter.get_node()
    if not node then
      return
    end
    local parent = node:parent()
    while parent and range_equal(parent, node) do
      parent = parent:parent()
    end
    if parent then
      stack[#stack + 1] = parent
      select_node(parent)
    else
      select_node(node)
    end
  end

  function sel.shrink()
    if #stack > 1 then
      stack[#stack] = nil
    end
    local node = stack[#stack]
    if node then
      select_node(node)
    end
  end
end

return {
  {
    'nvim-treesitter/nvim-treesitter',
    branch = 'main',
    build = ':TSUpdate',
    lazy = false,
    dependencies = {
      { 'nvim-treesitter/nvim-treesitter-textobjects', branch = 'main' },
    },
    opts_extend = { 'languages' }, -- concat languages from language modules
    opts = {
      languages = {},
    },
    config = function(_, opts)
      local ts = require 'nvim-treesitter'
      ts.setup {}

      -- install parsers requested by language modules
      local ensure = require('utils.table').unique(opts.languages)
      if #ensure > 0 then
        ts.install(ensure)
      end

      -- collect the filetypes registered for those parsers
      local filetypes = {}
      for _, lang in ipairs(ensure) do
        vim.list_extend(filetypes, vim.treesitter.language.get_filetypes(lang))
      end

      -- start highlight + indent per buffer
      vim.api.nvim_create_autocmd('FileType', {
        pattern = filetypes,
        callback = function()
          vim.treesitter.start()
          vim.bo.indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
        end,
      })

      -- incremental selection keymaps
      vim.keymap.set('n', '<leader>v', sel.init, { desc = 'Init selection' })
      vim.keymap.set('x', '<leader>v', sel.grow, { desc = 'Grow selection' })
      vim.keymap.set('x', '<leader>V', sel.shrink, { desc = 'Shrink selection' })
    end,
  },
}
