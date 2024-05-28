local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end

vim.opt.rtp:prepend(lazypath)

local status, lazy = pcall(require, "lazy")
if (not status) then
  print("Lazy is not installed")
  return
end

local plugins = {
  { "catppuccin/nvim",        name = "catppuccin" },
  'nvim-lua/plenary.nvim',
  'nvim-lualine/lualine.nvim',
  "williamboman/mason.nvim",
  'williamboman/mason-lspconfig.nvim',
  "jayp0521/mason-null-ls.nvim",
  {
    "nvimtools/none-ls.nvim",
    dependencies = {
      "nvimtools/none-ls-extras.nvim",
    },
  },
  'neovim/nvim-lspconfig',
  'onsails/lspkind-nvim',
  "hrsh7th/cmp-nvim-lsp-signature-help",
  'j-hui/fidget.nvim',
  'hrsh7th/nvim-cmp',
  'hrsh7th/cmp-buffer',
  'hrsh7th/cmp-nvim-lsp',
  "hrsh7th/cmp-nvim-lua",
  'L3MON4D3/LuaSnip',
  'saadparwaiz1/cmp_luasnip',
  "rafamadriz/friendly-snippets",
  {
    'nvim-treesitter/nvim-treesitter',
    build = ':TSUpdate'
  },
  'lewis6991/gitsigns.nvim',
  { 'sindrets/diffview.nvim', dependencies = 'nvim-lua/plenary.nvim' },
  'kyazdani42/nvim-web-devicons',
  'windwp/nvim-autopairs',
  'windwp/nvim-ts-autotag',
  'norcalli/nvim-colorizer.lua',
  'nvim-telescope/telescope.nvim',
  'nvim-telescope/telescope-file-browser.nvim',
  "napmn/react-extract.nvim",
  {
    "ThePrimeagen/refactoring.nvim",
    dependencies = {
      { "nvim-lua/plenary.nvim" },
      { "nvim-treesitter/nvim-treesitter" }
    }
  },
  ({
    'ckolkey/ts-node-action',
    dependencies = { 'nvim-treesitter' },
  }),
  "andrewferrier/debugprint.nvim",
  'terrortylor/nvim-comment',
  'smjonas/inc-rename.nvim',
  'echasnovski/mini.surround',
  {
    "SmiteshP/nvim-navbuddy",
    dependencies = {
      "neovim/nvim-lspconfig",
      "SmiteshP/nvim-navic",
      "MunifTanjim/nui.nvim"
    }
  },
  'lervag/vimtex',
  'folke/which-key.nvim',
  'github/copilot.vim',
  'jinh0/eyeliner.nvim',
  "m4xshen/hardtime.nvim",

  {
    "folke/noice.nvim",
    event = "VeryLazy",
    opts = {},
    dependencies = {
      "MunifTanjim/nui.nvim",
      "rcarriga/nvim-notify",
    }
  },
  {
    "luckasRanarison/nvim-devdocs",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-telescope/telescope.nvim",
      "nvim-treesitter/nvim-treesitter",
    },
    opts = {}
  },
  "saccarosium/neomarks",
  {
    'mikesmithgh/kitty-scrollback.nvim',
    enabled = true,
    lazy = true,
    cmd = { 'KittyScrollbackGenerateKittens', 'KittyScrollbackCheckHealth' },
    event = { 'User KittyScrollbackLaunch' },
    -- version = '*', -- latest stable version, may have breaking changes if major version changed
    -- version = '^2.0.0', -- pin major version, include fixes and features that do not have breaking changes
    config = function()
      require('kitty-scrollback').setup()
    end,
  },
  {
    'pwntester/octo.nvim',
    requires = {
      'nvim-lua/plenary.nvim',
      'nvim-telescope/telescope.nvim',
      'nvim-tree/nvim-web-devicons',
    },
    config = function()
      require "octo".setup()
    end
  },

  "wojciech-kulik/xcodebuild.nvim",

  'ThePrimeagen/vim-be-good',
  'nvim-treesitter/playground'
}

local opts = {}

lazy.setup(plugins, opts)
