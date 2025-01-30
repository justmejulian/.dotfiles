vim.g.mapleader = " "

-- Set node version to use for LSP
-- test using :!node -v
local home_dir = "/Users/julian.visser"
local node_bin = "/.nvm/versions/node/v23.5.0//bin"
vim.g.node_host_prog = home_dir .. node_bin .. "/node"
vim.cmd("let $PATH = '" .. home_dir .. node_bin .. ":' . $PATH")

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
