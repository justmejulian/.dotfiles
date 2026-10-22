# Conversational development orchestrator experiment

An alternative to the personal `develop` workflow: **chat directly with one
persistent orchestrator, which chooses specialists as needed**. The role
instructions describe a default flow, not a required sequence or workflow graph.
Existing workflows and agents remain unchanged by this experiment.

## Start and use

Reload Pi resources with `/reload`, then ask the root Pi session:

> Open exp-dev-orchestrator in a tab. I want to chat with it about development.

Or include a concrete entry point and explicit repository:

> Open exp-dev-orchestrator for /absolute/path/to/repository. Start by reviewing
> the current branch; do not implement anything yet.

The root launches the named agent using `subagent`, with an explicit machine
name and title. Continue chatting **in the orchestrator's Herdr tab**. It stays
open after answers; it does not route ordinary human questions back through the
launching parent. The parent can remain available separately. Normal child
lifecycle still applies: closing the launching parent may terminate its children.

Examples of requests inside that conversation:

- "Help me plan this change."
- "Implement this approved step in these files."
- "Review this branch."
- "Fix this review comment, but show me the proposed change first."
- "Run only the missing verification."
- "Prepare this branch for publication."
- "Where are we?" or "Switch to this other task."

The orchestrator inspects existing evidence through a specialist, chooses useful
work and skips already-satisfied phases. Midstream entry does not waive missing
edit/commit authority, stale review evidence or verification requirements.

## Agents

Definitions: `~/.pi/agent/agents/exp-dev-*.md`.

| Agent | Role |
| --- | --- |
| `exp-dev-orchestrator` | Persistent human-facing coordinator; delegates, asks direct questions, chooses the route |
| `exp-dev-context` | Repository/requirement intake, precedent and external run notes |
| `exp-dev-planner` | Decisions and proportionate atomic implementation plans |
| `exp-dev-implementer` | One authorized step/repair, targeted checks and one commit |
| `exp-dev-verifier` | Independent commit/state audit and final delivery checks |
| `exp-dev-reviewer` | Plan or exact-scope code review |
| `exp-dev-checker` | Skeptical finding validation |
| `exp-dev-publisher` | Read-only publication packet; no push or GitHub mutations in this trial |

All run in dedicated interactive Herdr tabs. Models/thinking inherit from the
launching parent; this does **not** reproduce the old workflows' fixed Claude
model assignments. The orchestrator is root-visible, can spawn only its seven
specialists and has no direct filesystem/shell tools. Specialists are visible
only to that orchestrator, cannot spawn further agents, and exit automatically.
The orchestrator itself remains open (`auto-exit: false`); automatic completion
and caller-ping exit tools are denied there.

The orchestrator loads the installed pi-question-tool extension for direct
question/choice forms. Other experimental agents disable normal extensions and
use explicit native tool lists. Required subagent lifecycle support is still
injected. A supported terminal multiplexer is required. Existing children/resumed
sessions retain their original launch configuration.

## Default flow, not mandatory routing

```text
Human chats with orchestrator
    ↕ direct questions and decisions
Orchestrator chooses among:
    context → planning → plan review
    approved implementation → targeted audit
    code review → skeptical check → bounded repairs
    final delivery verification → publication handoff
```

Only independent read-only assignments can run in parallel against a shared
checkout. One implementation writer per repository/worktree. Plans/permission
name literal files and the observed revision; existing dirty work is preserved
unless explicitly authorized for inclusion.

The human must explicitly authorize edit AND commit scope before implementation.
Planning consent, silence, empty responses or unannotated documents do not grant
that permission. Direct question forms return human answers to this conversation;
they do not create the old engine's protected decision records.

## Verification policy in this experiment

- Targeted tests and relevant static checks per implementation/repair step.
- Separate independent audits of commit ancestry, scope and dirty-state
  preservation; check missing receipts rather than accepting a vague "passed".
- Broader checks once after review on the final unchanged delivery revision.
- Full repository Jest when warranted by shared infrastructure, dependency or
  configuration changes, unclear impact, or stricter repository requirements.
- Separate named command results with elapsed time; never one opaque chain.
- Failed, skipped, receipt-only, timed-out and unknown checks remain explicit.
- Required CI is not replaced by local checks and is never reported passed
  without actual evidence.

Repairs invalidate affected review/verification evidence. Bounds: up to five
plan/interview revisions, two repairs per implementation step, three review/repair
rounds and two final verification repair/retry cycles. Stop on unchanged failing
evidence rather than repeating expensive commands blindly.

This is the new policy **only for the experimental agents**. The existing
personal workflow files still use their previous verification policy; their
previously requested policy update remains pending.

## Notes and recovery

The context agent writes only assigned artifacts under a unique external run
directory, normally beneath:

```text
~/.pi/agent/experiments/agent-development/runs/<unique-run>/
    task.md
    decisions.md
    plan.json
    status.md
    <explicit evidence and receipt files>
```

Do not commit run artifacts by default: they can contain private repository or
ticket context. The orchestrator keeps the artifact directory and useful child
continuation handles in its status updates. On resume, re-observe repository state
and invalidate stale evidence before acting. Switching projects must preserve
the previous project's ledger and keep authorities/evidence separate.

These files and Pi sessions support continuity, but they are **not** the durable
transactional checkpoint/retry graph supplied by pi-workflows. Replay protection,
source-identity enforcement, exact-once claims and protected human decision gates
are not supplied by these Markdown definitions. Tool restrictions are trusted
agent configuration, not OS sandboxing; permitted Bash can technically do more
than a role's instructions authorize.

## Publication boundary and current gaps

This first trial prepares an exact-revision publication packet, with clean state,
implementation/audit evidence, validated review, delivery coverage, CI facts and
a proposed draft PR body. It deliberately does **not** push, create/edit PRs,
reply to comments, resolve reviews or merge. The human can use the existing
protected publication workflow or perform a separately approved publication.
An agent packet is not automatically a compatible workflow input receipt.

Other gaps compared with the current workflows:

- No native Linear/Slack retrieval in experimental specialist profiles. Supply
  bounded context from the parent; do not invent access.
- No automatic PR feedback watcher, publication effects or CI monitoring loop.
- No automatic verification of a persisted ledger after a crash; reconcile from
  actual Git state and receipts.
- Static configuration can be validated without a development run; live nested
  tab delivery, direct questions and recovery still need a trial.

## Validation so far

- All eight definitions parse with installed pi-subagents 2.9.2.
- Installed spawn-policy functions accept root → orchestrator → each specialist
  and reject root → specialist; the configured remaining depth is one.
- Interactive placement, inherited models, async launches and lifecycle settings
  were checked. No global spawn-depth/width ceilings were present in the inspected
  parent environment; other launching sessions may differ.
- Pi 1.2.0's native extension loader registers both direct-question tools.
- Direct Node import of the full tool-policy module was unavailable because that
  checkout lacks a standalone pi-tui dependency. No dependencies were installed;
  tool allowlists were checked from parsed definitions and inspected source.
- No experimental agents, live nested tabs, application tests or publication
  operations were launched. Direct conversational behavior remains untested.
- Existing workflow implementation/configuration files still match their backup.

## Before removing the workflow system

The user intends to remove workflow machinery after the agent alternative works.
Do not remove it merely because these definitions exist. First validate the
conversational entry points, nested tabs, direct approvals, targeted/final check
policy, recovery and eventual publication/feedback/CI replacement. Finish or
explicitly stop active workflow runs, and preserve useful plans/decisions/history.

Retain general-purpose subagents, pi-question-tool, web tools and personal skills.
The current Slack bridge imports helpers from `agent/workflows/lib/`; move that
bridge to an independent location before deleting those helpers. Audit packaged
skills and Herdr integration dependencies before removing pi-workflows. Do not
remove credentials, unrelated integrations or run histories as incidental cleanup.

## Version control

These configuration sources are tracked through the user's `config` alias:

```sh
alias config='git --git-dir=$HOME/.dotfiles/ --work-tree=$HOME'
```

`~/.pi` does not contain its own `.git` directory. Use the existing dotfiles
repository through `config`; do not initialize another repository or blanket-stage
`~/.pi`. Commit only explicitly reviewed configuration/documentation sources,
excluding credentials, sessions, run artifacts, caches, installed dependencies
and backups. The pinned package declaration in `agent/settings.json` is sufficient
to reproduce the pi-question-tool installation; generated npm state is not part
of this configuration commit.
