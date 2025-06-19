local keymap = vim.keymap

-- Reload configuration without restart nvim
keymap.set('n', '<leader>n', ':so %<CR>', { desc = 'Reload [N]eovim [C]onfig' })

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

keymap.set('n', 'gF', '<C-w>vgf', { silent = true })

keymap.set({ 'n', 'v' }, '<leader>y', [["+y]], { desc = 'Copy to Clipboard' })
keymap.set('v', 'p', [["_dP]])

keymap.set('n', '<D-s>', ':w<CR>')
keymap.set('i', '<D-s>', '<Esc>:w<CR>')

keymap.set('n', '<C-J>', '<C-W><C-J>', { silent = true })
keymap.set('n', '<C-K>', '<C-W><C-K>', { silent = true })
keymap.set('n', '<C-L>', '<C-W><C-L>', { silent = true })
keymap.set('n', '<C-H>', '<C-W><C-H>', { silent = true })

keymap.set('n', '[b', '<cmd>bprevious<cr>', { desc = 'Prev Buffer' })
keymap.set('n', ']b', '<cmd>bnext<cr>', { desc = 'Next Buffer' })

keymap.set('n', '<ESC>', ':noh<Esc>', { silent = true })
