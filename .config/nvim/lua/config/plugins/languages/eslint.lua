return {
	{
		"neovim/nvim-lspconfig",
		opts = {
			servers = {
				eslint = {
					setup = {
						filetypes = {
							"javascript",
							"typescript",
							"typescript.glimmer",
							"javascript.glimmer",
							"json",
							"markdown",
						},
					},
				},
			},
		},
	},
}
