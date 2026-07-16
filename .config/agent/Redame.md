# Agent Config

Global config for coding agents (Claude Code, Pi, etc.). Tool-agnostic standard location.

| Dir | Purpose |
|---|---|
| `skills/` | Reusable agent skills |
| `mcp/` | MCP server configs |
| `prompts/` | Reusable prompt templates |

## Skills

Spec: [agentskills.io](https://agentskills.io/home) · Find more: [skills.sh](https://skills.sh/)

| Skill | Description |
|---|---|
| `humanizer` | Remove signs of AI-generated writing (Wikipedia's "Signs of AI writing" patterns) |
| `improve-codebase-architecture` | Surface architectural friction, propose deepening opportunities (testability, AI-navigability) |
| `revu` | Azure DevOps PR review comments via `REVU` marker format (symlinked from scripts repo) |
| `teach` | Language tutor — explain code with language-specific depth, suggest idiomatic improvements |
| `typst` | Generate idiomatic Typst (.typ) code, edit and troubleshoot Typst documents and projects, and answer Typst syntax/reference questions |

### Sources

- `skills/humanizer/`
  Source: <https://raw.githubusercontent.com/blader/humanizer/refs/heads/main/SKILL.md>

- `skills/improve-codebase-architecture/`
  Source: <https://raw.githubusercontent.com/mattpocock/skills/refs/heads/main/skills/engineering/improve-codebase-architecture/SKILL.md>

- `skills/typst/`
  Source: <https://raw.githubusercontent.com/apcamargo/typst-skills/refs/heads/main/typst-author/SKILL.md>

### Adding skills

Copy from GitHub or symlink from local repo. Script to automate: TODO.

## MCP

MCP (Model Context Protocol) server configs. Format varies by tool.

- Claude Code: `~/.claude/claude.json` (global) or `.claude/claude.json` (project). See [docs](https://docs.anthropic.com/en/docs/claude-code/mcp).

## Prompts

Reusable prompt templates. Each prompt is a markdown (`.md`) file. Syntax varies by tool:

- **opencode**: [command files](https://opencode.ai/docs/commands/#create-command-files)
- **Generic spec**: [prompt-templates.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md)
- **Claude Code**: uses `~/.claude/commands/` (separate dir — symlink to share).

## Tool wiring

Not all tools read `~/.config/agent/` yet. Symlink as needed.

### Claude Code

```sh
ln -s ~/.config/agent/skills ~/.claude/skills
```

### Pi

```sh
ln -s ~/.config/agent/skills ~/.pi/agent/skills
```
