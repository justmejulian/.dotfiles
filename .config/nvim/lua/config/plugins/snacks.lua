return {
  "folke/snacks.nvim",
  opts = {
    picker = {
      matcher = {
        frecency = true,
      },
      formatters = {
        file = {
          filename_first = true,
          truncate = 1000,
        },
      },
      win = {
        input = {
          keys = {
            -- todo mabye change
            ["<Esc>"] = { "", mode = { "n" } },
            ["<C-c>"] = { "close", mode = { "i", "n" } },
          }
        }
      }
    },
  },
  keys = {
    { ";;",         function() Snacks.picker() end,                      desc = "All Pickers" },
    { ";f",         function() Snacks.picker.files() end,                desc = "Files" },
    { ";g",         function() Snacks.picker.grep() end,                 desc = "Grep" },
    { ";s",         function() Snacks.picker.grep_word() end,            desc = "Visual selection or word", mode = { "n", "x" } },
    { ";b",         function() Snacks.picker.buffers() end,              desc = "Buffers" },
    { ";r",         function() Snacks.picker.resume() end,               desc = "Resume" },
    { ";c",         function() Snacks.picker.commands() end,             desc = "Commands" },
    { ";d",         function() Snacks.picker.diagnostics() end,          desc = "Diagnostics" },

    -- Git
    { "<leader>gs", function() Snacks.picker.git_status() end,           desc = "Git [S]tatus" },

    -- LSP
    { "gd",         function() Snacks.picker.lsp_definitions() end,      desc = "Goto [D]efinition" },
    { "gr",         function() Snacks.picker.lsp_references() end,       nowait = true,                     desc = "[R]eferences" },
    { "gI",         function() Snacks.picker.lsp_implementations() end,  desc = "Goto [I]mplementation" },
    { "gy",         function() Snacks.picker.lsp_type_definitions() end, desc = "Goto T[y]pe Definition" },

    { "<leader>cs", function() Snacks.picker.lsp_symbols() end,          desc = "LSP [S]ymbols" },

    -- NVIM
    {
      ";ne",
      function() Snacks.picker.files({ cwd = "~/.config/nvim/" }) end,
      desc = "[E]xplore NVIM config"
    },
    {
      ";nl",
      function() Snacks.picker.files({ cwd = "~/.local/share/nvim/" }) end,
      desc = "[E]xplore NVIM local"
    },
  }
}
