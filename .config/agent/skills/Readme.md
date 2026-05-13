# Agent Skills

Reusable skills for coding agents. Tool-agnostic standard location.

Spec: [agentskills.io](https://agentskills.io/home) · Find more: [skills.sh](https://skills.sh/)

## Skills

| Skill | Description |
|---|---|
| `improve-codebase-architecture` | Surface architectural friction, propose deepening opportunities (testability, AI-navigability) |
| `revu` | Azure DevOps PR review comments via `REVU` marker format (symlinked from scripts repo) |
| `teach` | Language tutor — explain code with language-specific depth, suggest idiomatic improvements |

### Sources

- `skills/improve-codebase-architecture/`
  Source: <https://raw.githubusercontent.com/mattpocock/skills/refs/heads/main/skills/engineering/improve-codebase-architecture/SKILL.md>


## Usage

Tool-agnostic location but not all tools read it.

### Claude Code

```sh
ln -s ~/.config/agent/skills ~/.claude/skills
```

## Adding skills

Copy from GitHub or symlink from local repo. Script to automate: TODO.

