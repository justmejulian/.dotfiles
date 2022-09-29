local keymap = vim.keymap

keymap.set('i', '<Left>', ':echoe "Use h"<CR>')
keymap.set('i','<Right>',':echoe "Use l"<CR>')
keymap.set('i','<Up>',':echoe "Use k"<CR>')
keymap.set('i','<Down>',':echoe "Use j"<CR>')

keymap.set('n','<Left>', '<ESC>:echoe "Use h"<CR>')
keymap.set('n','<Right>', '<ESC>:echoe "Use l"<CR>')
keymap.set('n','<Up>', '<ESC>:echoe "Use k"<CR>')
keymap.set('n','<Down>', '<ESC>:echoe "Use j"<CR>')

keymap.set('n', '<leader>w', ':w<CR>')
keymap.set('n', '<leader>q', ':q<CR>')
