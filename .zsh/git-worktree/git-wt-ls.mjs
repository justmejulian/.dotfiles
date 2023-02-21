$.verbose = false;
const { stdout } = await $`git worktree list`;
$.verbose = true;

const lines = stdout.split("\n");
const unfilteredWorktreeList = lines.map((line) => line.split(/\s+/)[0]); // first word of every line

// remove first (.bare) and last line (empty)
const worktrees = unfilteredWorktreeList.slice(
  1,
  unfilteredWorktreeList.length - 1
);

worktrees.map((worktree) => console.log(worktree));
