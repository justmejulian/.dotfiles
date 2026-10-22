# My Pi setup

Personal configuration under `~/.pi/agent`. Source definitions are authoritative;
installed capabilities do not prove every integration is authenticated.

## Context policy

Keep normal `pi` as lightweight as possible: short general instructions, active
tool schemas, skill/agent metadata and applicable project context. Do not preload
development flows, full specialist instructions, plans or run histories. Load
skills and project notes only when relevant. This README is documentation, not an
automatically injected context file.

Orchestration is **opt-in**, adds instructions only, and retains normal tools and
skills. Avoid putting its flow in a global AGENTS.md that reaches every session
and child. Specialists work in separate contexts and return concise findings.
Disabling a mode stops future injection; it cannot erase conversation history.

## Start and switch modes

```sh
pi                         # ordinary Pi, no orchestration guidance
pi --orchestrator          # ordinary Pi + orchestration guidance
pi-agent reviewer          # separate direct specialist chat
```

In Pi:

- `/orchestration [on|off|status]` — enable/disable/show guidance; no arguments means on.
- `/subagents` or **Alt+S** — manage/inspect delegated background workers.
- `/agent NAME [task]` or `/NAME [task]` — open a standalone specialist chat in Herdr.
  No task means idle; an explicit task starts work in that agent only.

Manual agent commands do not need a parent LLM routing call, but are **not managed
subagent calls**: results stay in their own conversations. The orchestrator uses
the `subagent` tool for delegation and automatic result delivery.

The Herdr new-workspace hook starts `pi --orchestrator` in the first `ai` tab. Existing
lazygit/serve/shell tab setup is retained; existing workspaces are not restarted.

## Agents

All eleven specialists are background managed subagents by default, auto-exit on
completion, and appear in the main widget and `/subagents`. No child Herdr tabs
are created for those launches. Direct CLI/slash launches deliberately open
persistent standalone conversations instead. Existing/resumed managed children
normally retain their original launch configuration.

| Agent | Purpose | Managed model / access |
| --- | --- | --- |
| `code-investigator` | Read-only local code/configuration/history research | GPT-6.1 Sol; main-session visible |
| `web-researcher` | Public documentation/upstream research | GPT-6 Luna; main-session visible |
| `context` | Intake, precedent and external project notes | Inherits parent; main-session visible |
| `planner` | Decisions and atomic implementation plans | Inherits parent; main-session visible |
| `implementer` | Approved edits, targeted checks and atomic commits | GPT-6.1 Sol, high; may call scout/fixer |
| `scout` | Focused read-only lookups | GPT-6 Luna, low; implementer-only |
| `fixer` | One mechanical lint/type/format repair attempt | GPT-6 Luna, low; implementer-only; no commit |
| `reviewer` | Independent plan/code review | Inherits parent; main-session visible |
| `checker` | Skeptical finding validation | Inherits parent; main-session visible |
| `verifier` | State/commit audits and delivery checks | Inherits parent; main-session visible |
| `publisher` | Publication packet and proposed PR text | Inherits parent; preparation only, no push |

There is one implementation family, no `exp-dev-*` duplicate family and no
separate orchestrator agent definition. Orchestration lives in
`agent/modes/orchestration.md`, loaded only when enabled. Detailed behavior,
permissions and limitations: [development guide](agent/development/README.md).

## Skills

Personal:
- `review-with-me` — paced human PR review; symlink to the Codex skill.
- `typescript-clean-code` — TypeScript-specific coding/review guidance.

Still supplied by the retained pi-workflows package:
- `autoplan`, `autodoc`, `autoimplement`, `monitor`, `pi-workflows`, `sanity-check`.

Skill names/descriptions/paths are advertised, not full skill contents. Full
instructions load on demand. `disable-model-invocation: true` makes a skill
manual-only; `/skill:NAME` can explicitly invoke it. Project/resource filtering
and active/deferred tool selection can further narrow availability.

## Tools and integrations

| Area | Entry points |
| --- | --- |
| Files/shell | Default `read`, `bash`, `edit`, `write`; optional grep/find/ls/PowerShell |
| Delegation | `subagent`, `subagent_resume`, `subagent_kill`; `/subagents` |
| Human input | `question`, `questionnaire` from pi-question-tool; TUI required |
| Web | `web_enable`, then search/fetch/source-check/stored-result tools |
| Slack | Read-only `slack_fetch`; `/slack LINK [question]` through Claude Code |
| Linear | Legacy workflow intake reads via Claude Code; no standalone Pi Linear tool yet |
| GitHub | `git`/`gh` plus existing review integrations; mutation needs appropriate authority |
| Cursor | SDK provider and local/cloud controls; cloud is opt-in, not verified here |
| Herdr | Agent state, PR review tabs, workspace setup; legacy `/piw tab` viewer |
| ActivityWatch | Session/activity reporting hook |
| Editing | pi-vim, annotated replies and declutter UI |

Annotated replies: `/reply`, `/reply-editor`, `/load-content`, `/load-content-editor`,
`/reply-diff`, `/reply-diff-editor` and `/annotated-reply*` aliases. Draft loading
is not checkpoint submission. Other helpers: `/clear`, `/pr-review` inside Herdr,
and Cursor's `/cursor-*` configuration/usage commands.

Nine personal extensions: `activitywatch.ts`, `agent-commands.ts`, `clear.ts`,
`herdr-agent-state.ts` (managed), `input-border.ts`, `orchestration.ts`,
`pr-review.ts`, `slack.ts`, `workflow-answer-prefill.ts` (legacy).

## Legacy workflows — not yet removed

Personal definitions: `investigate`, `plan`, `implement`, `review`, `refine`,
`publish`, `develop`, `address-feedback`. Packaged workflows: `plain-summary`,
`autoplan`, `autodoc`, `autoimplement`, `plan-approval`, `sanity-check`, `monitor`.
See [their existing contracts](agent/workflows/README.md).

These remain because Slack's helper/CLI and Herdr PR feedback watchers still
call into them. Removing the package would also remove six skills and protected
human-decision support. Their source files, histories and package have not been
deleted; no claim is made that instruction-based coordination reproduces those
engine guarantees. Workflow verification still runs its configured full suite;
the agent-based flow uses targeted checks and separate final verification.

## Configuration map

| Path | Contents |
| --- | --- |
| `agent/settings.json` | Default model, packages and resource selection |
| `agent/agents/` | Canonical specialist definitions |
| `agent/modes/orchestration.md` | Opt-in main-session guidance |
| `agent/extensions/` | Personal commands/tools and lifecycle/UI hooks |
| `agent/launchers/` | Direct specialist launcher/profile code and isolated tests |
| `agent/profiles/agent-cli/` | Ignored generated profiles; preserve sessions/artifacts |
| `agent/development/` | Development guide; private run notes when created |
| `agent/skills/` | Personal skill definitions/symlinks |
| `agent/workflows/` | Retained legacy workflows, helpers and history |
| `agent/npm/`, `agent/git/` | Installed dependencies; not cleanup targets |
| `~/.local/bin/pi-agent` | Direct specialist terminal launcher |
| `backups/` | Recovery copies; not committed or automatically loaded |

Run `/reload` after changing Pi resources. Keep credentials, sessions, histories,
run artifacts, generated profiles, installed dependencies and backups out of
configuration commits. Use the existing `config` alias:

```sh
alias config='git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME'
```

## Inspected installed versions

Pi **1.2.0**; pi-subagents **2.9.2**; pi-workflows **0.17.7**;
pi-server **1.1.0**; pi-question-tool **0.1.1**; pi-cursor-sdk **0.5.3**
(@cursor/sdk **1.0.37**); pi-web-access **0.44.0**; pi-annotated-reply **0.4.2**;
pi-vim **0.14.2**; pi-declutter **0.2.2**.

Cursor SDK extension and question-tool versions are pinned; other selections may
move. This inventory was inspected/updated on 2026-10-22, not runtime assurance.
