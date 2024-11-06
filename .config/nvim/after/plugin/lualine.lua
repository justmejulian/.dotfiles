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
    lualine_x = {
      {
        require("noice").api.statusline.mode.get,
        cond = require("noice").api.statusline.mode.has,
        color = { fg = "#ff9e64" },
      }
    },
    lualine_y = { 'encoding', 'fileformat', 'filetype' },
  }
}
