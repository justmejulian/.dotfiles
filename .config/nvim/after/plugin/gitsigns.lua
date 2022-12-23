local status, gitsigns = pcall(require, "gitsigns")
if (not status) then return end

gitsigns.setup {
  on_attach = function(bufnr)
    local function map(mode, lhs, rhs, opts)
      opts = vim.tbl_extend('force', { noremap = true, silent = true }, opts or {})
      vim.api.nvim_buf_set_keymap(bufnr, mode, lhs, rhs, opts)
    end

    -- Actions
    map('n', '<leader>gb', '<cmd>Gitsigns toggle_current_line_blame<CR>')
  end
}
