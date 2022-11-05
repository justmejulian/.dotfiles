local status, catppuccin = pcall(require, "catppuccin")
if (not status) then return end

catppuccin.setup {
  flavour = "mocha",
  integrations = {
    cmp = true,
    gitsigns = true,
    telescope = true,
    mason = true,
    which_key = true,
    treesitter = true,

    native_lsp = {
      enabled = true,
      virtual_text = {
        errors = { "italic" },
        hints = { "italic" },
        warnings = { "italic" },
        information = { "italic" },
      },
      underlines = {
        errors = { "underline" },
        hints = { "underline" },
        warnings = { "underline" },
        information = { "underline" },
      },
    },
  },
}

vim.api.nvim_command "colorscheme catppuccin"
