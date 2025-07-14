-- Snacks is defined in lua.lua
return {
  'folke/snacks.nvim',
  opts = {
    image = {
      -- requires brew install imagemagick
    },
    scope = {},
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
            ['<Esc>'] = { '', mode = { 'n' } },
            ['<C-c>'] = { 'close', mode = { 'i', 'n' } },
          },
        },
      },
    },
  },
  keys = {
    {
      ';;',
      function()
        Snacks.picker()
      end,
      desc = 'All Pickers',
    },
    {
      ';f',
      function()
        Snacks.picker.files()
      end,
      desc = 'Files',
    },
    {
      ';g',
      function()
        Snacks.picker.grep()
      end,
      desc = 'Grep',
    },
    {
      ';s',
      function()
        Snacks.picker.grep_word()
      end,
      desc = 'Visual selection or word',
      mode = { 'n', 'x' },
    },
    {
      ';b',
      function()
        Snacks.picker.buffers()
      end,
      desc = 'Buffers',
    },
    {
      ';r',
      function()
        Snacks.picker.resume()
      end,
      desc = 'Resume',
    },
    {
      ';c',
      function()
        Snacks.picker.commands()
      end,
      desc = 'Commands',
    },
    {
      ';d',
      function()
        Snacks.picker.diagnostics()
      end,
      desc = 'Diagnostics',
    },

    -- Git
    {
      '<leader>gs',
      function()
        Snacks.picker.git_status()
      end,
      desc = 'Git [S]tatus',
    },

    -- LSP
    {
      'gd',
      function()
        Snacks.picker.lsp_definitions()
      end,
      desc = 'Goto [D]efinition',
    },
    {
      'gr',
      function()
        Snacks.picker.lsp_references()
      end,
      nowait = true,
      desc = '[R]eferences',
    },
    {
      'gI',
      function()
        Snacks.picker.lsp_implementations()
      end,
      desc = 'Goto [I]mplementation',
    },
    {
      'gy',
      function()
        Snacks.picker.lsp_type_definitions()
      end,
      desc = 'Goto T[y]pe Definition',
    },

    {
      '<leader>cs',
      function()
        Snacks.picker.lsp_symbols()
      end,
      desc = 'LSP [S]ymbols',
    },

    -- NVIM
    {
      ';ne',
      function()
        Snacks.picker.files { cwd = '~/.config/nvim/' }
      end,
      desc = '[E]xplore NVIM config',
    },
    {
      ';nl',
      function()
        Snacks.picker.files { cwd = '~/.local/share/nvim/' }
      end,
      desc = '[E]xplore NVIM local',
    },
    {
      '<leader>td',
      function()
        local params = vim.lsp.util.make_position_params()

        vim.lsp.buf_request(0, 'textDocument/typeDefinition', params, function(err, result, _, _)
          if err then
            vim.notify('LSP error: ' .. err.message, vim.log.levels.ERROR)
            return
          end
          if not result or vim.tbl_isempty(result) then
            vim.notify('No type definitions found', vim.log.levels.INFO)
            return
          end

          -- Normalize to list of locations
          local locations = vim.tbl_islist(result) and result or { result }

          -- Use the first location
          local loc = locations[1]
          local fname = vim.uri_to_fname(loc.uri)
          local range = loc.range

          Snacks.win {
            file = fname,
            width = 0.6,
            height = 0.6,
            title = 'Type Definition',
            row = 0.2,
            col = 0.2,
            focus = true,
            wo = {
              wrap = false,
              spell = false,
              signcolumn = 'yes',
              statuscolumn = ' ',
              conceallevel = 3,
            },
            on_open = function(bufnr, winid)
              vim.api.nvim_set_current_win(winid)
              vim.api.nvim_win_set_cursor(winid, {
                range.start.line + 1,
                range.start.character,
              })
            end,
          }
          vim.lsp.buf.type_definition()
        end)
      end,
      desc = 'Type Definition in Snacks.win',
    },
  },
}
