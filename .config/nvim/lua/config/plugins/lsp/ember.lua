local function get_related_files()
  local file_path = vim.fn.expand('%:p') -- Get the full path of the current file
  local params = {
    command = 'els.getRelatedFiles',
    arguments = {
      file_path,               -- First argument: the file path
      { includeMeta = false }, -- Optional flags, default to not include metadata
    },
  }

  vim.lsp.buf_request(0, 'workspace/executeCommand', params, function(err, result, ctx, config)
    if err then
      vim.notify('Error: ' .. err.message, vim.log.levels.ERROR)
      return
    end

    if result and #result > 0 then
      local items = {}
      for _, file in ipairs(result) do
        table.insert(items, {
          text = vim.fn.fnamemodify(file, ":t"), -- Display only the filename
          path = file,                           -- Store the full path
          preview = { text = file },             -- Optional preview text
        })
      end
      return items
    else
      vim.notify('No related files found.', vim.log.levels.INFO)
    end
  end)
end


vim.api.nvim_create_user_command('GetRelatedFiles', function()
  local relatedFiles = get_related_files()
  vim.notify('Related Files:\n' .. vim.inspect(relatedFiles), vim.log.levels.INFO)
end, {})

-- require('snacks').picker.pick {
--   finder = get_related_files,
--   layout = {
--     preset = "ivy",
--   },
-- }

return {
  setup = function(lspconfig, capabilities)
    lspconfig.ember.setup { capabilites = capabilities }
    lspconfig.glint.setup { capabilites = capabilities }
  end
}
