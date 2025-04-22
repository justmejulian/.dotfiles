return {
	{
		"stevearc/conform.nvim",
		opts = { formatters_by_ft = { javascript = { "prettierd" } } },
	},
	{
		"nvim-treesitter/nvim-treesitter",
		opts = { languages = { "javascript", "typescript" } },
	},
	{
		"neovim/nvim-lspconfig",
		opts = {
			servers = {
				vtsls = {},
			},
		},
	},
}
