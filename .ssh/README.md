# ssh

## SSH key for github

https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent

## Handling Multiple Github Accounts on MacOS
https://gist.github.com/Jonalogy/54091c98946cfe4f8cdab2bea79430f9

Create the ssh keys and add the to github.

Add the following to `~/.ssh/.config`:
```
#user1 account
Host github.com-user1
   HostName github.com
   User git
   IdentityFile ~/.ssh/github-user1
   IdentitiesOnly yes

#user2 account
Host github.com-user2
   HostName github.com
   User git
   IdentityFile ~/.ssh/github-user2
   IdentitiesOnly yes
```

git clone your respective repository:
```
git clone git@github.com-user1:user1/your-repo-name.git your-repo-name_user1
```

Ensure your remote url is correct:
```
git remote set-url origin git@github.com-user1:user1/your-repo-name.git your-repo-name_user1
```
