# Conversational development

Use normal Pi as the main conversation, optionally adding orchestration guidance.
There is no separate orchestrator agent or mandatory workflow graph.

## Start

```sh
pi                       # normal Pi; minimal base context
pi --orchestrator        # normal Pi + orchestration instructions
pi-dev                   # shorthand for pi --orchestrator
```

Inside a session:

```text
/orchestration           enable guidance for subsequent requests
/orchestration off       stop adding the guidance
/orchestration status    show the current mode
```

Enabling the mode does not start a model request, change tools/models/skills, or
spawn agents. The instructions are read lazily from `../modes/orchestration.md`
only before a request with the mode enabled. The boolean mode state is saved as a
custom session entry excluded from model context, so native session resume can
restore it. Managed children do not inherit the main-session mode. Turning it off
cannot erase instructions already present in conversation history.

`pi-dev` no longer creates an isolated orchestrator profile. It uses ordinary Pi,
its normal settings, providers, authentication, project context and integrations.
The Herdr new-workspace hook opens it in the first `ai` tab. Existing workspaces
are not restarted. Plain `pi` remains unchanged.

## Default flow, flexible entry

```text
You ↔ Main Pi, optionally in orchestration mode
       ├─ context / planner
       ├─ implementer
       │    ├─ scout
       │    └─ fixer
       ├─ reviewer / checker
       ├─ verifier
       ├─ publisher (preparation only)
       └─ code-investigator / web-researcher
```

The flow is guidance: enter at planning, implementation, review, feedback repair,
verification or publication preparation. Reuse current evidence and gather only
missing/stale prerequisites. Do not redo implementation merely to follow a
sequence. The main conversation owns framing, decisions and coordination.

All eleven specialist definitions in `../agents/` are managed **background**
subagents. They report to their parent and exit when done. Use `/subagents` or
Alt+S and the main widget for status/activity/results; background workers do not
create Herdr child tabs. New launches use this configuration; existing/resumed
children keep their original launch shape.

The implementation family is consolidated: one `implementer`, one `scout` and one
`fixer`. The original model/thinking defaults and implementation result fields are
retained. The implementer uses targeted checks unless the brief or repository
requires full verification; legacy workflow briefs still explicitly require it.

## Direct specialist conversations

For a separate human-facing chat, not managed delegation:

```sh
pi-agent reviewer
pi-agent code-investigator "Inspect this repository read-only"
```

Inside Pi in Herdr, every enabled personal agent has `/NAME [task]`, for example
`/reviewer` or `/code-investigator inspect this repo`. `/agent NAME [task]` is the
generic form. An empty task opens an idle conversation. These deterministic
commands do not call a parent model to route the launch.

**Direct sessions are independent chats:** they stay open and their results do
not return to the calling conversation. The orchestrator uses the `subagent`
tool, not these slash commands, when it needs a report back.

The generic standalone launcher remains because slash commands depend on it. It
derives narrowly scoped profiles under `../profiles/agent-cli/`, references
existing credential/model files by symlink rather than copying them, and keeps
sessions/artifacts separate. Canonical definitions are unchanged by profile
preparation. Only immediate allowed children become root-visible in a profile;
nested-helper visibility is retained. Project overrides shadowing the allowed
catalog are rejected. These are trusted extension guards, not an OS sandbox.
Custom provider extensions must be declared by a specialist; inherited native
provider defaults and explicit role model settings are supported.

Do not delete old generated profiles wholesale: they may contain prior sessions
or artifacts. Their contents are ignored by version control.

## Permission, verification and continuity

- Ask directly for product/scope tradeoffs; explicit edit/commit authority names
  literal files and observed state. Silence, cancellation and empty responses are
  not approval. Preserve unrelated user work.
- Targeted tests/static checks per implementation/repair step; broader checks
  once on the final unchanged delivery revision. Full Jest is for broad/shared
  changes, uncertain impact or stricter repository policy. Required CI remains.
- Record each check's actual outcome/timing and skipped/unknown coverage. Inspect
  scripts, bound commands and ask before risky/shared-service checks.
- Use independent review and skeptical validation; repair only material blockers
  within authority. A fix invalidates affected review/verification evidence.
- Keep task, decisions, plan, status and evidence references outside the application
  repository, normally under `runs/`. Read notes on demand; do not preload histories.
- These instructions do not supply the old workflow engine's protected human
  decision records, transactional retries or source-identity enforcement.
- Publisher currently prepares a revision-bound packet and draft PR text only.
  It does not push, mutate GitHub or merge. No automated publication replacement
  is implied by this cleanup.

Context intake currently needs ticket/Slack excerpts from the parent when those
tools are unavailable in its narrowed environment; do not invent access.

## Legacy workflows: retained dependencies

The old workflow sources/package are not yet safe to remove:

1. `extensions/slack.ts` and `workflows/bin/slack-fetch` import the workflow Slack
   helper, Claude runner and transcript/stat storage.
2. The Herdr PR review watchers start `address-feedback` using `/workflow`, query
   `pi-workflows runs`, and rely on its active-marker lifecycle.
3. Removing the package also removes its planning, implementation, monitoring and
   sanity-check skills and human-decision support.

Move the bridge/storage, migrate or explicitly disable watchers, and check active
runs/channels before retiring the package. Preserve histories and do not silently
replace protected publication decisions with model-returned approvals.

The duplicate `exp-dev-*` definitions and old experiment guide have been removed
from discovery. Backups under `~/.pi/backups/` and dotfiles commits retain them.
Existing workflow implementation files remain unchanged.

## Validation and version control

Tests use temporary fixtures and fake executables: profile preparation, all-agent
command registration, safe task quoting, tool/visibility guards, instruction-only
mode switching, child isolation and the CLI shorthand. Native offline no-prompt
RPC checks validate startup without model tokens. Live task delegation and actual
Herdr tab creation are not exercised by those tests.

Run tests with `node --test ~/.pi/agent/launchers/*.test.mjs`; TypeScript checking
uses the focused `launchers/tsconfig.json`. Never run the application's full suite
just to validate these personal configuration changes.

Commit reviewed source files through the `config` dotfiles alias. Exclude
credentials, sessions, run artifacts, generated profiles, installed dependencies
and backups. Plain Pi needs only short common instructions and resource metadata;
keep the orchestration flow out of inherited global AGENTS.md files.
