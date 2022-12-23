local status, packer = pcall(require, "packer")
if (not status) then
  print("Packer is not installed")
  return
end

vim.cmd [[packadd packer.nvim]]

packer.startup(function(use)
  use 'wbthomason/packer.nvim'

  use { "catppuccin/nvim", as = "catppuccin" }

  use 'nvim-lua/plenary.nvim' -- Common utilities

  use 'nvim-lualine/lualine.nvim'

  use "williamboman/mason.nvim"
  use 'williamboman/mason-lspconfig.nvim'
  use "jayp0521/mason-null-ls.nvim"

  use "jose-elias-alvarez/null-ls.nvim"

  use 'neovim/nvim-lspconfig' -- LSP
  use 'onsails/lspkind-nvim' -- vscode-like pictograms
  use "hrsh7th/cmp-nvim-lsp-signature-help"
  use 'j-hui/fidget.nvim'

  use 'hrsh7th/nvim-cmp' -- Completion
  use 'hrsh7th/cmp-buffer' -- nvim-cmp source for buffer words
  use 'hrsh7th/cmp-nvim-lsp' -- nvim-cmp source for neovim's built-in LSP
  use "hrsh7th/cmp-nvim-lua"

  use 'L3MON4D3/LuaSnip'
  use 'saadparwaiz1/cmp_luasnip'
  use "rafamadriz/friendly-snippets"

  use {
    'nvim-treesitter/nvim-treesitter',
    run = ':TSUpdate'
  }


  use 'lewis6991/gitsigns.nvim' -- can also use for blame
  use { 'sindrets/diffview.nvim', requires = 'nvim-lua/plenary.nvim' }


  use 'kyazdani42/nvim-web-devicons' -- File icons
  use 'windwp/nvim-autopairs'
  use 'windwp/nvim-ts-autotag'
  use 'norcalli/nvim-colorizer.lua'

  use 'nvim-telescope/telescope.nvim'
  use 'nvim-telescope/telescope-file-browser.nvim'

  use "napmn/react-extract.nvim"
  use {
    "ThePrimeagen/refactoring.nvim",
    requires = {
      { "nvim-lua/plenary.nvim" },
      { "nvim-treesitter/nvim-treesitter" }
    }
  }

  use 'folke/which-key.nvim'
end)
