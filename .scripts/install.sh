# https://www.atlassian.com/git/tutorials/dotfiles

git clone --bare https://github.com/justmejulian/.dotfiles.git $HOME/.dotfiles
function config {
   /usr/bin/git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME $@
}
config checkout
config submodule update --init
config config status.showUntrackedFiles no
