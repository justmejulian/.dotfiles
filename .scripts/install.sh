# https://www.atlassian.com/git/tutorials/dotfiles

git clone --bare git@github.com:justmejulian/.dotfiles.git $HOME/.dotfiles
function config {
   /usr/bin/git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME $@
}
config checkout
config config status.showUntrackedFiles no
