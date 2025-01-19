return {
  "folke/snacks.nvim",
  opts = {
    picker = {},
  },
  keys = {
    { ";;", function() Snacks.picker() end, desc = "Buffers" },
    { ";f", function() Snacks.picker.files() end, desc = "Buffers" },
    { ";g", function() Snacks.picker.grep() end, desc = "Grep" },
  }
}
