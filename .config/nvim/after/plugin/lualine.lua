local status, lualine = pcall(require, "lualine")
if (not status) then return end

lualine.setup {
  options = {
    theme = "catppuccin",
  },
  sections = {
    lualine_c = {
      {
        'filename',
        file_status = true,
        path = 1,
      }
    },
    lualine_x = { 'encoding', 'fileformat', 'filetype' },
  }
}
