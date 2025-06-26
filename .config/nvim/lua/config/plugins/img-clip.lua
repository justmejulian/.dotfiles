-- brew install pngpaste
return {
  'HakonHarnes/img-clip.nvim',
  event = 'VeryLazy',
  command = {
    'PasteImage',
    'PasteImageWithName',
  },
  opts = {
    filetypes = {
      codecompanion = {
        prompt_for_file_name = false,
        template = '[Image]($FILE_PATH)',
        use_absolute_path = true,
      },
    },
  },
  keys = {
    -- suggested keymap
    -- { '<leader>p', '<cmd>PasteImage<cr>', desc = 'Paste image from system clipboard' },
  },
}
