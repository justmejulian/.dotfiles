local status, mason = pcall(require, "mason")
if (not status) then return end
local status2, masonLspconfig = pcall(require, "mason-lspconfig")
if (not status2) then return end
local status3, lspconfig = pcall(require, "lspconfig")
if (not status3) then return end

masonLspconfig.setup_handlers {
    -- This is a default handler that will be called for each installed server (also for new servers that are installed during a session)
    function(server_name)
        lspconfig[server_name].setup {}
    end,
    -- You can also override the default handler for specific servers by providing them as keys, like so:
    ["sumneko_lua"] = function()
        lspconfig.sumneko_lua.setup({
            settings = {
                Lua = {
                    -- Tells Lua that a global variable named vim exists to not have warnings when configuring neovim
                    diagnostics = {
                        globals = { "vim" },
                    },
                },
            },
        })
    end,
}

mason.setup({})

masonLspconfig.setup {
    ensure_installed = { "sumneko_lua", "tailwindcss" },
}

vim.keymap.set('n', '<Leader>m', '<Cmd>Mason<CR>', { desc = "Mason" })
