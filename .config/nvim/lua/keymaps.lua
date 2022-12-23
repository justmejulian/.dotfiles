local keymap = vim.keymap

keymap.set('i', '<Left>', '<ESC>:echoe "Use h"<CR>')
keymap.set('i', '<Right>', '<ESC>:echoe "Use l"<CR>')
keymap.set('i', '<Up>', '<ESC>:echoe "Use k"<CR>')
keymap.set('i', '<Down>', '<ESC>:echoe "Use j"<CR>')

keymap.set('n', '<Left>', '<ESC>:echoe "Use h"<CR>')
keymap.set('n', '<Right>', '<ESC>:echoe "Use l"<CR>')
keymap.set('n', '<Up>', '<ESC>:echoe "Use k"<CR>')
keymap.set('n', '<Down>', '<ESC>:echoe "Use j"<CR>')

keymap.set('n', '<C-d>', '<C-d>zz')
keymap.set('n', '<C-u>', '<C-u>zz')

keymap.set("v", "p", [["_dP]])
keymap.set({"n", "v"}, "<leader>y", [["+y]])

keymap.set('n', '<leader>w', ':w<CR>')
keymap.set('n', '<leader>q', ':q<CR>')
