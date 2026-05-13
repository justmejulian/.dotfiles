# Agent Config

Global config for coding agents (Claude Code, etc.).

| Dir | Purpose |
|---|---|
| `skills/` | Reusable agent skills (tool-agnostic) |
| `mcp/` | MCP server configs |
| `prompts/` | Reusable prompt templates |

## Claude Code wiring

```sh
ln -s ~/.config/agent/skills ~/.claude/skills
```
