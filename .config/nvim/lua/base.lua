vim.g.mapleader = " "

vim.wo.number = true
vim.wo.relativenumber = true

-- Case insensitive searching UNLESS /C or capital in search
vim.o.ignorecase = true
vim.o.smartcase = true

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

-- highlight yanked text for 200ms using the "Visual" highlight group
vim.cmd[[
augroup highlight_yank
autocmd!
au TextYankPost * silent! lua vim.highlight.on_yank({higroup="Visual", timeout=200})
augroup END
]]
