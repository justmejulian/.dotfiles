vim.g.mapleader = " "

vim.wo.number = true
vim.wo.relativenumber = true

vim.opt.laststatus = 2

vim.opt.mouse = vim.opt.mouse + 'a'

vim.opt.tabstop = 2
vim.opt.shiftwidth = 4
vim.opt.softtabstop = 4
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
]]--
vim.opt.listchars = {
    nbsp = '␣',
    trail = '•',
    tab = '--→',
}
