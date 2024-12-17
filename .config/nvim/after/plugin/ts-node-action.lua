local status, tsNodeAction = pcall(require, "ts-node-action")
if (not status) then return end

tsNodeAction.setup({})

vim.keymap.set('n', '<Leader>t', tsNodeAction.node_action, { desc = "Ts node action" })
