local status, reactExtract = pcall(require, "react-extract")
if (not status) then return end

reactExtract.setup()

vim.keymap.set("v", "<Leader>rre", reactExtract.extract_to_new_file)
vim.keymap.set("v", "<Leader>rrc", reactExtract.extract_to_current_file)
