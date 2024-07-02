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

keymap.set("n", "gF", "<C-w>vgf", { silent = true })

keymap.set({ "n", "v" }, "<leader>y", [["+y]])
keymap.set("v", "p", [["_dP]])

keymap.set('n', '<D-s>', ':w<CR>')
keymap.set('i', '<D-s>', '<Esc>:w<CR>')
-- Reload configuration without restart nvim
keymap.set('n', '<leader>r', ':so %<CR>', { desc = "Reload Config" })

keymap.set("n", "<C-J>", "<C-W><C-J>", { silent = true })
keymap.set("n", "<C-K>", "<C-W><C-K>", { silent = true })
keymap.set("n", "<C-L>", "<C-W><C-L>", { silent = true })
keymap.set("n", "<C-H>", "<C-W><C-H>", { silent = true })

keymap.set('n', '<CR>', 'm`o<Esc>``')
keymap.set('n', '<S-CR>', 'm`O<Esc>``')

keymap.set('n', '<ESC>', ':noh<Esc>', { silent = true })

keymap.set('n', '<leader>cp', ':CopyRpath<Esc>')

keymap.set('n', '<leader>gce', ':Copilot enable<Esc>:echoe "Yip"<CR>')
keymap.set('n', '<leader>gcd', ':Copilot disable<Esc>:echoe "Nope"<CR>')
