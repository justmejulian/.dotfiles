baseLocation=~/.zsh/git-worktree
function gwt () {
    # todo: add error handeling
    # todo: add completion and help
    case "$1" in
      clone)
        zx $baseLocation/git-clone.mjs $2;;

      checkout)
        if [[ "$2" == "-b" ]]; then
          if [[ $(pwd) == $(git root) ]]; then
            echo "You have to be in a worktree to create new branch"
            return
          fi
          echo "Create new brnach"
          git branch $3
          name=$3
        else
          name=$2
        fi
        cd $(git root)
        git worktree add $name $name
        # todo: run hook
        ;;

      switch)
        selectedWorktree=$(zx $baseLocation/git-wt-ls.mjs $2 | fzf)
        # cd if worktree selected
        [ -z "$selectedWorktree" ] || cd $selectedWorktree
        ;;

      remove)
        selectedWorktree=$(zx $baseLocation/git-wt-ls.mjs $2 | fzf)
        git worktree remove $selectedWorktree
        git worktree prune
        git branch -d $selectedWorktree
        ;;

      *) echo "Sorry don't know how to help you there";;  # match everything
    esac

}
