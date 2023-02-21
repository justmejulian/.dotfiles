// Git clone bare repo
// Inpired by
// https://morgan.cugerone.com/blog/workarounds-to-git-worktree-using-bare-repository-and-cannot-fetch-remote-branches/

// Examples of call:
// git-clone-bare-for-worktrees git@github.com:name/repo.git
// => Clones to a /repo directory

const url = argv._[0];

// get name from clone url
const regex = /.*\/(.*)\.git/;
const match = regex.exec(url);
const name = match[1];

// todo: fail if can't find name

await $`mkdir ${name}`;
cd(name);

await $`git clone --bare ${url} .bare`;
await $`echo "gitdir: ./.bare" > .git`;

// Explicitly sets the remote origin fetch so we can fetch remote branches
await $`git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"`;

// Set root dir as alias
$.verbose = false;
const root = await $`pwd`;
$.verbose = true;
await $`git config alias.root '!echo ${root}'`;

await $`git fetch origin`;
