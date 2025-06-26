return {
  {
    'mason-org/mason.nvim',
    cmd = 'Mason',
    keys = { { '<leader>m', '<cmd>Mason<cr>', desc = 'Mason' } },
    build = ':MasonUpdate',
  },
}
