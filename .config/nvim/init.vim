set nocompatible
let mapleader = "\<Space>"

" =============================================================================
" # PLUGINS
" =============================================================================
" install using
" sh -c 'curl -fLo "${XDG_DATA_HOME:-$HOME/.local/share}"/nvim/site/autoload/plug.vim --create-dirs https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim'
call plug#begin()
  Plug 'doums/darcula'
  Plug 'catppuccin/nvim', {'as': 'catppuccin'}
  Plug 'neoclide/coc.nvim', {'branch': 'release'} " .config/coc/extensions/package.json
  Plug 'rafamadriz/friendly-snippets'
  Plug 'folke/which-key.nvim'
  Plug 'kyazdani42/nvim-web-devicons' " for file icons
  Plug 'kyazdani42/nvim-tree.lua'
call plug#end()

lua << EOF
  require'nvim-tree'.setup {}
  require("which-key").setup {}

  local catppuccin = require("catppuccin")
  catppuccin.setup()
EOF
" =============================================================================
" # CONFIG
" =============================================================================
" install using
" Turn on syntax highlighting.
syntax on

" Show line numbers.
set number

" This enables relative line numbering mode
set relativenumber

" Always show the status line at the bottom, even if you only have one window open.
set laststatus=2

" By default, Vim doesn't let you hide a buffer (i.e. have a buffer that isn't
" shown in any window) that has unsaved changes. This is to prevent you from "
" forgetting about unsaved changes and then quitting e.g. via `:qa!`. We find
" hidden buffers helpful enough to disable this protection. See `:help hidden`
" for more information on this.
set hidden

" This setting makes search case-insensitive when all characters in the string
" being searched are lowercase. However, the search becomes case-sensitive if
" it contains any capital letters. This makes searching more convenient.
set ignorecase
set smartcase

" Enable searching as you type, rather than waiting till you press enter.
set incsearch

" Enable mouse support
set mouse+=a

set autoindent
set tabstop=2
set shiftwidth=4
set softtabstop=4
set expandtab

" Sane splits
set splitright
set splitbelow

" Show those damn hidden characters
set list

set showbreak=↪\ 
" Verbose:
" set listchars=tab:→\ ,eol:↲,nbsp:␣,trail:•,extends:⟩,precedes:⟨
set listchars=tab:→\ ,nbsp:␣,trail:•

" =============================================================================
" # KEYMAPPING
" =============================================================================
" Try to prevent bad habits like using the arrow keys for movement
" Do this in normal mode...
nnoremap <Left>  :echoe "Use h"<CR>
nnoremap <Right> :echoe "Use l"<CR>
nnoremap <Up>    :echoe "Use k"<CR>
nnoremap <Down>  :echoe "Use j"<CR>
" ...and in insert mode
inoremap <Left>  <ESC>:echoe "Use h"<CR>
inoremap <Right> <ESC>:echoe "Use l"<CR>
inoremap <Up>    <ESC>:echoe "Use k"<CR>
inoremap <Down>  <ESC>:echoe "Use j"<CR>

nnoremap <Leader>sv :source $MYVIMRC<CR>

nmap <leader>w :w<CR>
nmap <leader>q :q<CR>

nnoremap <leader>nt :NvimTreeToggle<CR>
nnoremap <leader>nr :NvimTreeRefresh<CR>
nnoremap <leader>n :NvimTreeFindFile<CR>

" Make <tab> used for trigger completion, completion confirm, snippet expand and jump like VSCode.
" used by coc-snippets
inoremap <silent><expr> <TAB>
      \ pumvisible() ? coc#_select_confirm() :
      \ coc#expandableOrJumpable() ? "\<C-r>=coc#rpc#request('doKeymap', ['snippets-expand-jump',''])\<CR>" :
      \ <SID>check_back_space() ? "\<TAB>" :
      \ coc#refresh()

function! s:check_back_space() abort
  let col = col('.') - 1
  return !col || getline('.')[col - 1]  =~# '\s'
endfunction

let g:coc_snippet_next = '<tab>'

" =============================================================================
" # MISC
" =============================================================================
" enable colorscheme
" colorscheme darcula
" let g:catppuccin_flavour = "dusk" " latte, frappe, macchiato, mocha
" let g:catppuccin_flavour = "latte" " latte, frappe, macchiato, mocha
" let g:catppuccin_flavour = "frappe" " latte, frappe, macchiato, mocha
" let g:catppuccin_flavour = "macchiato" " latte, frappe, macchiato, mocha
let g:catppuccin_flavour = "mocha" " latte, frappe, macchiato, mocha
colorscheme catppuccin
