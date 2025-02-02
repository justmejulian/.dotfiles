local home_dir = "/Users/julian.visser"

-- Set node version to use for LSP
-- test using :!node -v
local node_bin =  "/.nvm/versions/node/v20.18.0/bin"
vim.g.node_host_prog = home_dir .. node_bin .. "/node"

vim.cmd("let $PATH = '" .. home_dir .. node_bin .. ":' . $PATH")

vim.g.mapleader = " "

vim.wo.number = true
vim.wo.relativenumber = true

-- Case insensitive searching UNLESS /C or capital in search
vim.o.ignorecase = true
vim.o.smartcase = true

vim.opt.spelllang = 'en_gb'
vim.opt.spell = true
vim.opt.spelloptions = "camel"

vim.opt.laststatus = 2

vim.opt.mouse = vim.opt.mouse + 'a'

vim.opt.tabstop = 2
vim.opt.shiftwidth = 2
vim.opt.softtabstop = 2
vim.opt.expandtab = true

vim.opt.splitbelow = true
vim.opt.splitright = true

vim.opt.list = true
--[[
vim.opt.listchars = {
    nbsp = '␣',
    trail = '•',
    eol = '↵',
    tab = '--→',
}
]]
--

vim.opt.listchars = {
  nbsp = '␣',
  trail = '•',
  tab = '--→',
}

vim.filetype.add({
  filename = {
    [".env"] = "dotenv",
  },
  pattern = {
    [".env"] = "dotenv",
    [".env.*"] = "dotenv",
  },
})

vim.treesitter.language.register('bash', 'dotenv')

-- highlight yanked text for 200ms using the "Visual" highlight group
vim.cmd [[
  augroup highlight_yank
  autocmd!
  au TextYankPost * silent! lua vim.highlight.on_yank({higroup="Visual", timeout=200})
  augroup END
]]

vim.api.nvim_create_user_command("CopyApath", function()
  local path = vim.fn.expand("%:p")
  vim.fn.setreg("+", path)
  vim.notify('Copied "' .. path .. '" to the clipboard!')
end, {})

vim.api.nvim_create_user_command("CopyRpath", function()
  local path = vim.fn.expand("%:.")
  vim.fn.setreg("+", path)
  vim.notify('Copied "' .. path .. '" to the clipboard!')
end, {})

vim.api.nvim_create_user_command( 'SplitSentences', function()
    vim.cmd([[%s/[.!?] /.\r/g]])
  end,
  { desc = "Place each sentence on a new line in the current buffer" }
)

-- Automatically set the title of the terminal tab to the current file
vim.api.nvim_create_autocmd({ "VimLeavePre" }, {
  callback = function()
    os.execute('kitten @ set-tab-title')
  end
})
