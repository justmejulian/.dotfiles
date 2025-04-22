local path = require("utils.path")
local case = require("utils.case")

local function get_related_files(callback)
	local file_path = vim.fn.expand("%:p") -- Get the full path of the current file
	local params = {
		command = "els.getRelatedFiles",
		arguments = {
			file_path, -- First argument: the file path
			{ includeMeta = false }, -- Optional flags, default to not include metadata
		},
	}

	vim.lsp.buf_request(0, "workspace/executeCommand", params, function(err, results, ctx, config)
		if err then
			vim.notify("Error: " .. err.message, vim.log.levels.ERROR)
			return
		end

		local items = {}

		if results and #results > 0 then
			for index, result in pairs(results) do
				table.insert(items, {
					text = result,
					file = result, -- Full path for use later
					index = index, -- Store original index
				})
			end
		end

		if next(items) ~= nil then
			callback(items)
		end
	end)
end

return {
	{
		"stevearc/conform.nvim",
		opts = { formatters_by_ft = { javascript = { "prettierd" } } },
	},
	{
		"nvim-treesitter/nvim-treesitter",
		opts = { languages = { "javascript", "typescript", "html", "css", "glimmer" } },
	},
	{
		"neovim/nvim-lspconfig",
		opts = {
			servers = {
				ember = {},
				glint = {},
			},
		},
	},
	{
		"folke/snacks.nvim",
		keys = {
			{
				"<leader>cr",
				function()
					local picker = require("snacks.picker")

					get_related_files(function(items)
						if not items or #items == 0 then
							vim.notify("No related files found.", vim.log.levels.WARN)
							return
						end

						picker.pick({
							title = "Related Files",
							items = items,
							format = "file",
							actions = {
								-- todo add open in split
								confirm = function(picker, item)
									picker:close()
									vim.cmd("edit " .. item.file) -- Open the selected file
								end,
							},
						})
					end)
				end,
				desc = "Select [R]elated Files",
			},
			{
				"gR",
				function()
					local picker = require("snacks.picker")
					local relative_path = path.get_relative_path()
					local path_without_ext = relative_path:gsub("%.hbs$", "")
					if not path_without_ext:match("^app/components/") then
						vim.notify("Not inside app/components/, skipping...", vim.log.levels.WARN)
						return nil
					end

					-- Remove "app/components/"
					local cleaned_path = path_without_ext:gsub("^app/components/", "")
					local formatted = cleaned_path
						:gsub("/", "::") -- Replace `/` with `::`
						:gsub("(%a[%w%-]*)", case.to_pascal_case) -- Convert each segment to PascalCase
					picker.grep({
						search = formatted,
					})
				end,
				desc = "get [R]eferenced Files",
			},
		},
	},
}
