local function getFormatterNames(formatters)
  if not next(formatters) then
    return nil
  end
  local names = {}
  for _, formatter in ipairs(formatters) do
    table.insert(names, formatter.name)
  end
  return table.concat(names, ',')
end

return {
  {
    'mason-org/mason.nvim',
  },
  {
    'zapling/mason-conform.nvim',
  },
  {
    'stevearc/conform.nvim',
    event = { 'BufReadPre', 'BufNewFile' },
    opts = { formatters_by_ft = {} },
    config = function(_, opts)
      local fidget = require 'fidget'

      local mason = require 'mason'
      local mason_conform = require 'mason-conform'
      mason.setup()
      mason_conform.setup {}

      local conform = require 'conform'
      conform.setup { formatters_by_ft = opts.formatters_by_ft }
      vim.api.nvim_create_autocmd('BufWritePre', {
        pattern = '*',
        callback = function(args)
          local list_formatters = conform.list_formatters(args.buf)
          local formatters = getFormatterNames(list_formatters)
          if formatters ~= nil then
            fidget.notify('Formatting with ' .. formatters)
            conform.format({ bufnr = args.buf }, function(err)
              -- if err then
              --   fidget.notify('Formatting failed: ' .. err, 'error')
              -- end
            end)
          else
            fidget.notify('No formatters found for ' .. vim.bo[args.buf].filetype)
          end
        end,
      })
    end,
  },
}
