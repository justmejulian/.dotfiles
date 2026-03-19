# Jira CLI

https://github.com/ankitpokhrel/jira-cli

## Setup

1. Create a Personal Access Token in Jira
2. Export it in your shell profile:

```sh
export JIRA_API_TOKEN='xxxx'
```

## Common commands

**List my open issues**
```sh
jira issue list -a$(jira me) -q"statusCategory != Done" --plain --no-headers
```

**Issues in current sprint**
```sh
jira issue list --jql "project = SA AND sprint in openSprints() AND statusCategory != Done" --order-by rank --reverse --plain --no-headers
```

**Issues in current sprint assigned to me**
```sh
jira issue list --jql "project = SA AND sprint in openSprints() AND assignee = currentUser() AND statusCategory != Done" --order-by rank --reverse --plain --no-headers
```

**View an issue**
```sh
jira issue view SA-1234
```

**Open issue in browser**
```sh
jira open SA-1234
```

**Move issue to In Progress**
```sh
jira issue move SA-1234 "In Progress"
```

**Add a comment**
```sh
jira issue comment add SA-1234
```

**Create an issue**
```sh
jira issue create -tStory -s"Issue title" -yMedium --no-input
```

## Config

Config file: `~/.config/.jira/.config.yml`
