# My Pi setup

Inventory of the configuration under `~/.pi/agent`, inspected on 2026-10-22.
These are configured/discoverable capabilities, not proof every extension has
loaded successfully or every integration is authenticated. Tools can vary by
session, selected model, runtime and enabled capabilities.

## At a glance

- **13 personal agents** (5 original + 8 experimental conversational-development agents)
- **8 configured skills**
- **8 personal workflows + 7 discoverable packaged workflows**
- **7 personal extensions + 8 configured extension packages**
- Default parent model: `openai-codex/gpt-6.1-sol`

## Agents

Definitions: `agent/agents/`.

| Agent | Purpose | Default model / thinking | Execution |
| --- | --- | --- | --- |
| `code-investigator` | Read-only code, configuration, dependency and history investigation | `openai-codex/gpt-6.1-sol`; thinking unspecified | Interactive Herdr tab, asynchronous; 15-minute limit |
| `web-researcher` | Public documentation, upstream source and issue research | `openai-codex/gpt-6-luna`; thinking unspecified | Interactive Herdr tab, asynchronous; 15-minute limit |
| `implementer` | Implement one approved step, run checks and create one atomic commit; never push | `openai-codex/gpt-6.1-sol`, high | Interactive Herdr tab, synchronous; may delegate to scout/fixer |
| `scout` | Quick read-only repository lookups with file/line evidence | `openai-codex/gpt-6-luna`, low | Implementer-only; interactive Herdr tab, synchronous; 10-minute limit |
| `fixer` | One attempt at mechanical lint, type or formatting failures | `openai-codex/gpt-6-luna`, low | Implementer-only; interactive Herdr tab, synchronous; 15-minute limit |

All five definitions disallow model overrides. All are currently configured for
interactive execution with `PI_SUBAGENT_HERDR_PLACEMENT=tab` and automatic exit on
completion. Async/sync behavior is independent of tab visibility and remains as
listed above. New launches use these settings; resumed children normally preserve
their original launch mode. A supported terminal multiplexer is required.
The parent-visible roster normally contains only the first three; `scout` and
`fixer` are implementer delegates. Workflow steps and internal headless Claude
roles are not converted into separate agent tabs by these settings.

### Experimental conversational development agents

A parallel agent-driven alternative to `develop`, not a new workflow. Open
`exp-dev-orchestrator` and chat directly in its persistent Herdr tab. It chooses
which specialists to call and can enter at any phase; the flow is guidance rather
than fixed graph routing.

| Agent | Purpose |
| --- | --- |
| `exp-dev-orchestrator` | Persistent conversation, delegation and direct human questions |
| `exp-dev-context` | Repository intake, precedent and external run notes |
| `exp-dev-planner` | Decisions and minimal atomic plans |
| `exp-dev-implementer` | Approved single-step implementation and targeted checks |
| `exp-dev-verifier` | Independent state/commit audit and final delivery checks |
| `exp-dev-reviewer` | Plan or code review |
| `exp-dev-checker` | Skeptical validation of findings |
| `exp-dev-publisher` | Publication preparation only; no push/GitHub mutations yet |

All are interactive Herdr tabs with inherited models. Only the orchestrator is
root-visible; it can launch its seven specialists, which cannot spawn children.
The orchestrator stays open and uses `question`/`questionnaire` for direct human
input; specialists auto-exit. Its filesystem/shell work is delegated.

This experiment uses targeted checks per step and broader checks once before
delivery; existing workflow verification rules have not changed. It lacks the
workflow engine's protected decision gates and durable graph recovery. Existing
workflows remain until the replacement is trialed and its gaps are addressed.

See [the experiment guide](agent/experiments/agent-development/README.md) for
starting midway, permissions, verification, recovery, publication limits and the
future workflow-removal checklist.

### Claude Code delegates

These are internal headless Claude Code roles, not additional personal Pi agents.
Definitions and tool permissions: `agent/workflows/lib/claude.ts`.

| Role | Purpose | Model / effort |
| --- | --- | --- |
| `intake` | Read Linear issues, comments, attachments and images | `claude-sonnet-5-5`, low |
| `slack` | Read Slack threads, channels and user profiles | `claude-sonnet-5-5`, low |
| `planner` | Plan with `workflow-explorer` and `workflow-planner` delegates | `claude-opus-5-5`, xhigh |
| `planReview` | Review a plan with an explorer | `claude-opus-5-5`, high |
| `finalReview` | Run code/repository review skills and agents | `claude-opus-5-5`, xhigh |
| `checker` | Skeptically validate review findings | `claude-opus-5-5`, high |
| `prWriter` | Create draft pull requests | `claude-sonnet-5-5`, medium |
| `prMaintenance` | Maintain PR metadata | `claude-sonnet-5-5`, medium |

Each role has a fixed model, effort and tool allowlist. Referenced Claude agents
and skills describe intended use; their availability was not independently tested.

## Skills

Pi advertises skill metadata and loads full instructions when applicable. Skills
are not all permanently expanded into the prompt. Explicit invocation is available
through `/skill:<name>`.

| Skill | Purpose | Source |
| --- | --- | --- |
| `review-with-me` | Paced human PR review with GitHub, Linear and Slack context | Personal; symlink to `~/.codex/skills/review-with-me` |
| `typescript-clean-code` | Clean Code guidance for TypeScript edits and reviews | Personal |
| `autoplan` | Compare solutions and produce a selected implementation plan | pi-workflows |
| `autodoc` | Record an existing selected plan in canonical docs without implementing it | pi-workflows |
| `autoimplement` | Implement a plan, test, review and verify CI/CD | pi-workflows |
| `monitor` | Track long-running work and advance/recover authorized work | pi-workflows |
| `pi-workflows` | Operate, author and debug durable workflows | pi-workflows |
| `sanity-check` | Assess necessity, scope, contracts and tests without editing | pi-workflows |

Personal definitions: `agent/skills/`. Packaged definitions:
`agent/npm/node_modules/@osolmaz/pi-workflows/skills/`.

## Workflows

### Personal workflows

Definitions: `agent/workflows/*.workflow.ts`. Detailed contracts and examples:
[`agent/workflows/README.md`](agent/workflows/README.md).

| Workflow | Purpose |
| --- | --- |
| `investigate` | Frame a question, coordinate code/web research, cross-check and report evidence with bounded follow-ups |
| `plan` | Linear/linked Slack intake, interview, decisions, planning and Claude plan review |
| `implement` | Execute an approved plan or validated review with atomic commits and full verification |
| `review` | Read-only Claude final review plus skeptical checker; no implementation or publication |
| `refine` | Bounded review → implement/verify → review repair loop |
| `publish` | Protected human approval, exact-SHA push, draft PR and Herdr review tab |
| `develop` | Full personal development pipeline |
| `address-feedback` | Collect PR feedback, validate/repair, review, maintain PR and reply |

```text
develop
  → plan
  → explicit approval
  → implement
  → refine: review → repair → verify → review
  → publish: exact-SHA approval → push → draft PR
```

Stages are independently available. `refine` includes `review` and `implement`;
`address-feedback` includes `review`. Included stages share their parent run's
progress, pause and cancellation rather than starting independent child runs.
Protected human decisions cannot be approved by the model-facing workflow tool.

### Packaged workflows

Provided by `@osolmaz/pi-workflows`:

| Workflow | Purpose |
| --- | --- |
| `plain-summary` | Plain-language summary of supplied material |
| `autoplan` | Compare solutions and plan implementation |
| `autodoc` | Document selected plans |
| `autoimplement` | Implement plans, verify, review and follow CI/CD |
| `plan-approval` | Human approval, stop or replan decision |
| `sanity-check` | Read-only contribution necessity/scope/contracts/test assessment |
| `monitor` | Durable observation and authorized goal completion/recovery |

Internal composition workflows, intentionally omitted from ordinary discovery:

- `change-verification` — select/run checks and route verification or repair.
- `plan-change` — shared planning, documentation, approval and replanning chain.
- `workspace-preparation` — inspect and prepare the workspace/task branch.

Personal `plan`/`implement` and packaged `autoplan`/`autoimplement` are distinct
systems, not aliases. No workflow name collisions were found. Discovery precedence
is project → personal/global → unshadowed packaged built-ins.

## Tools and integrations

### Files and shell

Normal startup tools are `read`, `bash`, `edit`, `write`. Pi also provides
`powershell`, `grep`, `find`, and `ls` when selected or exposed by the runtime.
Helpers narrow their own toolsets. Optional built-in integrations include
`codemode`, `tool_search`, MCP and llama.cpp; installed availability is not the
same as the active tool list in a particular session.

### Slack

- `slack_fetch` — read a Slack message/thread link, including authors, times,
  summary and an optional question.
- `/slack <link> [question]` — show the same result interactively.

Bridge: `agent/extensions/slack.ts` → `agent/workflows/lib/slack.ts` → headless
Claude Code's `slack` role. Allowed connector operations are
`slack_read_thread`, `slack_read_channel`, and `slack_read_user_profile`.
This is a read-only bridge, not a general Slack write API.

### Linear and GitHub

- Linear reading is available through the workflow `intake` Claude role:
  `get_issue`, `list_comments`, `get_attachment`, `extract_images`.
- Personal `plan` gathers issue context and up to five linked Slack threads.
- **No standalone Linear Pi tool has been created yet.** A requested helper for
  direct reads and explicitly authorized updates remains pending.
- Claude Code tool discovery exposed Linear `get_issue`, `list_comments`,
  `list_issues`, `save_issue`, and `save_comment`; discovery did not read or mutate
  an issue, and is not a completed write-path test.
- GitHub operations use `git`, `gh`, and Claude workflow delegates rather than a
  separately registered personal GitHub tool. Permissions differ by workflow.

### Subagents — pi-subagents

Tools:

- `subagent` — launch a helper or a parallel group.
- `subagent_resume` — continue a previous helper session.
- `subagent_kill` — stop a helper.

Controls: `/subagents`, **Alt+S**.

Conditional child-protocol tools: `caller_ping`, `subagent_done`.
Optional `set_tab_title` requires `PI_SUBAGENT_ENABLE_SET_TAB_TITLE`; enablement
was not confirmed. Child-only `/auto-exit` restores automatic exit after operator
interaction.

### Workflow engine — pi-workflows

- `workflow` — discover, start, inspect, restart, pause/resume/cancel, adjust
  settings/follow-ups, answer ordinary checkpoints, publish updates and submit
  step results.
- `/workflow` — human-facing workflow operations, including protected decisions.
- `/workflow-channel` — decision-channel configuration/status/recovery; Telegram
  support exists but configuration/authentication was not established.
- `/resource-manager` — manage workflow resources.
- `/piw` — choose placement for the current workflow viewer in Herdr.
- `/piw tab` — open the current workflow in a dedicated viewer tab; `b` toggles
  the global run browser. Standalone `piw` opens the global browser directly.
  Viewer tabs show workflow state, not separate executing agent sessions.
  Automatic tab opening is not configured/supported by the inspected 0.17.7 integration.

Progress widgets and viewer shortcuts are UI features, not additional model tools.

### Web — pi-web-access

| Tool | Purpose |
| --- | --- |
| `web_enable` | Expose configured web tools on subsequent requests |
| `web_search` | Search/provider answers with sources |
| `source_check` | Bounded claim-evidence artifacts with passage citations |
| `fetch_content` | Retrieve URLs, including supported PDF/GitHub/image/video handling |
| `get_search_content` | Browse stored results and find passages |

Commands: `/websearch`, `/curator`, `/google-account`, `/search`.
Provider availability and authentication were not tested in the inventory.

### Cursor — pi-cursor-sdk

Adds the Cursor model provider, local/cloud runtime controls, lifecycle handling
and native-tool/activity presentation.

Conditional tools: `cursor_ask_question`, `cursor_activate_skill`.
Native wrappers reuse `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`.
The `cursor` activity entry is presentation/replay, not an independent general
Cursor delegation tool.

Commands:

- `/cursor-refresh-models`
- `/cursor-runtime`
- `/cursor-cloud`
- `/cursor-fast`
- `/cursor-tools`
- `/cursor-http`
- `/cursor-local-resume-cleanup`
- `/cursor-refresh-config`
- `/cursor-mode`
- `/cursor-usage`

Cloud execution is opt-in, with acknowledgement/preflight and different tool and
context-transfer behavior. No personal `cursor-sdk.json` or verified cloud run was
found during the inventory. Package installation does not prove login/cloud access.

## Editing and interface

### Annotated replies — pi-annotated-reply

Annotate responses, files and diffs:

- `/reply`, `/reply-editor`
- `/load-content`, `/load-content-editor`
- `/reply-diff`, `/reply-diff-editor`
- `/annotated-reply`, `/annotated-reply-editor`
- `/annotated-reply-diff`, `/annotated-reply-diff-editor`

### Structured questions — pi-question-tool

Installed and pinned at `0.1.1`. Pi 1.2.0's extension loader successfully registered
both tools; interactive behavior has not yet been tested.

- `question` — one choice list with descriptions and free-text fallback.
- `questionnaire` — multiple questions, tab navigation and a final submission screen.

These tools require TUI mode. They return responses to the agent; they do not
automatically answer workflow checkpoints or replace protected human approvals.
Run `/reload` in an existing session to load the newly installed extension.

### Other packages

- **pi-vim** — modal editing, motions, operators, visual mode and ex commands.
- **pi-declutter** — compact activity/tool rendering; `/activity-patch` diagnoses
  runtime hooks.

### Personal extensions

Definitions: `agent/extensions/`.

| Extension | Function |
| --- | --- |
| `slack.ts` | Slack read tool and command |
| `clear.ts` | `/clear` starts a new session |
| `pr-review.ts` | `/pr-review [number\|url]` and automatic review-tab opening after successful `gh pr create`; only registered inside Herdr |
| `herdr-agent-state.ts` | Report agent lifecycle/state through Herdr sockets |
| `activitywatch.ts` | Session/activity/prompt reporting and 30-second heartbeat through `~/.local/bin/aw-hook` |
| `input-border.ts` | Editor border compatible with pi-vim |
| `workflow-answer-prefill.ts` | Prefill `/workflow answer <decision-id>` while idle; never automatically answer or approve |

No personal prompt templates or configured package prompt resources were found.

## Installed versions

Versions describe the inspected installation, not permanent pins.

| Component | Version |
| --- | --- |
| Pi | `1.2.0` |
| pi-workflows | `0.17.7` |
| pi-server | `1.1.0` |
| pi-subagents | `2.9.2` (checkout `cf6dbf4`) |
| pi-cursor-sdk | `0.5.3` |
| @cursor/sdk | `1.0.37` |
| pi-web-access | `0.44.0` |
| pi-question-tool | `0.1.1` |
| pi-annotated-reply | `0.4.2` |
| pi-vim | `0.14.2` |
| pi-declutter | `0.2.2` |

Cursor SDK extension `0.5.3` and pi-question-tool `0.1.1` are explicitly pinned
in settings. Other configured package selections are unpinned. No resource exclusions/package selection filters
were found in personal settings.

## Configuration map and maintenance

| Path under `~/.pi/` | Contents |
| --- | --- |
| `agent/settings.json` | Models, configured packages and resource selections |
| `agent/agents/` | Personal Pi agent definitions |
| `agent/experiments/agent-development/` | Conversational orchestrator experiment guide and private run notes |
| `agent/skills/` | Personal skill definitions/symlinks |
| `agent/workflows/` | Personal workflows, shared helpers and workflow documentation |
| `agent/extensions/` | Personal callable tools, commands and lifecycle/UI hooks |
| `agent/npm/node_modules/` | Installed npm extension packages and bundled resources |
| `agent/git/github.com/edxeth/pi-subagents/` | Configured subagents source checkout |

Use `/reload` after manually changing Pi resources. Update this inventory when
adding/removing agents, skills, workflows or extensions; the source definitions
remain authoritative. Project-level resources and CLI overrides can change the
capabilities available in a specific session and were not inferred from the home
directory.
