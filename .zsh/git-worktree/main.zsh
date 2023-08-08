baseLocation=~/.zsh/git-worktree
function gwt () {
    # todo: add error handeling
    # todo: add completion and help
    root=$(git root)
    case "$1" in
      clone)
        zx $baseLocation/git-clone.mjs $2;;

      checkout)
        if [[ "$2" == "-b" ]]; then
          if [[ $(pwd) == $root ]]; then
            echo "You have to be in a worktree to create new branch"
            return
          fi
          echo "Create new brnach"
          git branch $3
          name=$3
        else
          name=$2
        fi
        cd $root
        git worktree add $name $name
        # todo: run hook
        ;;

      switch)
        if [ -z "$2" ]; then
          selectedWorktreePath=$(zx $baseLocation/git-wt-ls.mjs $2 | fzf)
        else
          selectedWorktreePath=$root'/'$2
        fi
        # cd if worktree selected
        [ -z "$selectedWorktreePath" ] || cd $selectedWorktreePath
        ;;

      remove)
        if [ -z "$2" ]; then
          selectedWorktreePath=$(zx $baseLocation/git-wt-ls.mjs $2 | fzf)
          selectedWorktree=${selectedWorktreePath//"$root"/}
        else
          selectedWorktreePath=$root'/'$2
          selectedWorktree=$2
        fi
        git worktree remove $selectedWorktree
        git worktree prune
        git branch -d $selectedWorktree
        ;;

      *) echo "Sorry don't know how to help you there";;  # match everything
    esac

}
