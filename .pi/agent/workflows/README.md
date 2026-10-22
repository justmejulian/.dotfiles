# Personal development workflows

All stages are discoverable global workflows. Use `/workflow <name> --input-json '<JSON>'`
or the `workflow` tool with `action: "start"`, `workflow: "<name>"`, and `input`.
`/workflow develop VIZ-123 task notes` and `/workflow plan VIZ-123 task notes`
retain the task intake entry point.

| Stage | Work | Named exits |
| --- | --- | --- |
| `investigate` | Read-only framing, coordinated code/web research, cross-checking, bounded follow-ups and an evidence-backed report | terminal result: `answered`, `needs_evidence`, `blocked` |
| `plan` | Linear/linked Slack intake, precedent-first interview, decisions review, planning and Claude plan review | `ready`, `blocked` |
| `implement` | Explicit approved plan **or** validated review, Pi `implementer`, full verification after each atomic commit, up to two in-place verification repairs | `ready`, `blocked` |
| `review` | Existing Claude final-review skills, then skeptical checker; no edits, commits, app launch, repairs or publication | `ready`, `blocked` |
| `refine` | `review → implement/verify → review`, at most three repair rounds by default (configurable 0–5) | `ready`, `blocked` |
| `publish` | Protected human push decision, exact approved SHA push, draft PR, Herdr review-tab setup | `ready`, `revise`, `blocked` |
| `develop` | `plan → explicit plan/edit/commit approval → implement → refine → publish` | `ready`, `blocked` |

`address-feedback` also includes `review`; its feedback collection, repair,
PR maintenance and reply behavior remain its own. Reviewer/checker model,
effort, tools and repo skills are unchanged. No child run is started: typed
`includeWorkflow()` mounts share the root's progress, cancellation and pause.
Parents consume only named child results, never child node outputs.

## Investigation: understand before changing code

```text
/workflow investigate --input-json '{"task":"Why does X happen instead of Y?","repository":"/absolute/path/to/repo"}'
```

Invoke the workflow directly; there is no separate investigation skill. Its
methodology and research orchestration are defined in `investigate.workflow.ts`.
`task` is required; `repository` is optional (for public-only or non-repository
questions) and must be absolute when supplied. Optional
`constraints` records boundaries. `maxFollowUps` defaults to 2, accepts 0–3,
and should change only when requested. Unknown input fields are rejected.

Stages: `frame → research → check → [followUp → record → check] → report`.
One research stage coordinates the named `code-investigator` and `web-researcher`
helpers, launching independent tracks together. If public research needs a local
version first, that dependency is resolved before web dispatch. The parent owns
relevant private GitHub/Linear/Slack context. Each stage saves accepted output;
helper progress within an unsubmitted research stage is not independently durable.

Cross-checking chooses answered, a targeted follow-up, or blocked. Follow-ups
save their request and evidence separately. Exhausting the budget yields
`needs_evidence`, never an invented conclusion. Failed/timed-out research stages
produce a blocked report; accepted evidence remains in run state. A failed report
leaves the prepared result saved but the run failed for ordinary terminal recovery.
Cancellation stays terminal and never routes into recovery/reporting.

Input and submitted records are limited to 8,000 JSON characters each so the
bounded follow-up history fits the installed engine's prompt budget. Summarize
findings with exact references instead of copying raw logs. Agent deadlines are
explicit (10 minutes framing/report, 30 minutes research/follow-up, 15 minutes
cross-checking); disconnected, waiting and paused time does not count.

No edits, commits, installations, deployments or remote mutations are authorized.
This is trusted-agent policy, **not an OS sandbox**: shell and helper tools must
still be used read-only. Missing sources and skipped core tracks need a concrete
reason. Existing workflow pause/resume/cancel and source-identity rules apply.
Tests use scripted researchers and the installed engine; live model/helper
handoff and real internal-service access are not exercised.

## Review only: latest commit plus endpoint-marker working-tree changes

```json
{
  "repository": "/absolute/path/to/repo",
  "base": "HEAD~1",
  "task": "Review the latest commit and endpoint-marker changes against the endpoint contract",
  "scope": {
    "paths": ["src/endpoint.ts", "src/endpoint.test.ts"],
    "includeUncommitted": true
  }
}
```

Start `review` with this input. `base` is resolved once to an ancestor SHA;
reviewer **and** checker receive the same exact base-to-HEAD/working-tree
scope and evidence digest. With `includeUncommitted: true`, the scope includes
index, unstaged and untracked contents, including index-only changes. With
`false`, only committed changes are reviewed. `paths: []` reviews the entire
repository diff. Paths are literal repository-relative paths, never globs.
Supply `branch` optionally to require that branch. `runDir` and `piPane` are
optional; parents pass them explicitly when already known. A supplied `runDir`
must be absolute and outside the repository (including through symlinks).

The ready result contains `setup`, `revision` (resolved base, branch, HEAD,
scoped digest and dirty-state fingerprints), `summary`, validated `blocking`,
`noted`, `skipped`, and per-finding validation `evidence`. Ready means the
review completed, **not** that no blockers exist. An incomplete checker result,
a failed/timed-out reviewer, or changing repository state blocks the stage.
Read-only review writes only workflow artifacts, not repository files.

## Refinement: explicit authority, not inferred from a review request

Start `refine` with the review input above plus:

```json
{
  "authority": {
    "edit": true,
    "commit": true,
    "files": ["src/endpoint.ts", "src/endpoint.test.ts"],
    "includeUncommitted": true
  },
  "maxRounds": 3
}
```

Combine these fields into **one** input object. This authorizes inclusion of
existing dirty changes only in those exact files. If dirty work in a target
file must be preserved outside the commit, do not grant this authority: split
that work yourself first. Partial-file ownership is deliberately unsupported.
Without authority, `refine` can finish a clean review but blocks on findings;
it never silently upgrades review-only input to edit/commit permission.

Only validated **blocking** findings are repaired automatically; noted items
are returned for judgment. An out-of-authority finding stops for a scope/product
decision. Repair is one atomic commit per review round, followed by full verify
and a fresh review. No intake, planning, push or PR happens. Even a clean initial
review does not automatically commit existing dirty work.

The index must be empty before implementation. Unrelated unstaged/untracked
work is preserved, fingerprinted and excluded from commits. Literal edit targets
cannot be directories or symlinks. The implementer receives the exact authority;
audits check changed commit paths, parent SHA, reported SHA, branch, residual
dirty work and unrelated fingerprints. This is trusted-agent enforcement plus
post-work auditing, **not an OS sandbox**. Concurrent work can safely block the
run; avoid concurrent edits to the target files. No reset/stash/clean is used.

Repeated identical findings with unchanged revision/evidence, exhausted rounds,
failed repair or verification return blocked with saved evidence. A new commit
counts as changed evidence but cannot bypass the round bound.

## Standalone implementation and publication

`implement` takes the common review fields, `authority`, `approved: true` and:

```json
{
  "plan": {
    "summary": "Add the endpoint marker",
    "steps": [{
      "title": "Add marker",
      "goal": "Implement the approved endpoint marker behavior",
      "files": ["src/endpoint.ts", "src/endpoint.test.ts"],
      "acceptance": ["Both endpoint paths expose the agreed marker"],
      "checks": ["Run endpoint tests and the full verify suite"]
    }],
    "risks": []
  }
}
```

Alternatively supply `validatedReview: <review ready output>` instead of
`approved`/`plan`. Its revision must still match. Edit and commit authority is
required in either case. `expectedRevision` can additionally bind an approved
plan to observed state. Implementation returns explicit `setup`, `revision`,
`verification` and final `commits` receipts. Verification fixes amend only the
latest workflow-owned commit; ordinary steps never amend preexisting commits.
A missing full-suite command in `verify.conf` blocks implementation.

`publish` accepts `{ "review": <clean review ready output>, "implementation":
<implement ready output> }`. Both must refer to the same repository, base,
branch and current revision, and the worktree/index must be clean. A protected
human decision is mandatory, with no automatic approval timeout. Approval binds
the exact state and SHA; state changes before push block rather than reusing
approval. Push uses that exact SHA, never an unbound `HEAD`, without force.
“Fix first” exits `revise` without editing. `develop` applies those instructions
within the approved files, verifies/re-reviews, then asks for a fresh approval.
Never force-push, merge, mark a PR ready, or delete a branch.

## Full development and reusable compositions

```json
{ "task": "VIZ-123 Add the agreed endpoint marker" }
```

Start `develop`. Existing interview/decision annotations, planner roles and
plan-review escalation remain. A new protected plan decision grants explicit
edit/commit authority for the plan's literal files; it does **not** grant push
permission. Implementation/refinement blockers retain a human retry/stop gate;
retries cannot silently expand scope. Root and child step limits remain bounded.

Example parent mount (the same pattern used by `develop` and `refine`):

```ts
includes: {
  review: includeWorkflow(reviewWorkflow, {
    input: ({ outputs }) => ({
      repository: prepared.repository,
      base: prepared.base,
      branch: prepared.branch,
      task: approvedTask,
      runDir: prepared.runDir,
      scope: { paths: ["src/endpoint.ts"], includeUncommitted: true },
    }),
  }),
},
edges: [
  { from: "observe", to: "review" },
  { from: "review.ready", to: "decide" },
  { from: "review.blocked", to: "blocked" },
]
// decide reads includedResult(reviewWorkflow, outputs.review), not child internals.
```

## Verification and operational limits

From this directory, with the installed `../npm/node_modules/@osolmaz/pi-workflows`:

```sh
npm ci --ignore-scripts
npm run verify
```

This runs strict TypeScript checks (including invalid typed child contracts),
installed-package discovery/loading and isolated engine tests. Claude is a local
fake executable; implementers, verify, approvals and publication effects are
scripted where appropriate. Only temporary Git repositories and temporary SQLite
databases are used. No real reviewer, Herdr, remote Git or PR operation is tested.
The package's own development/e2e suite is not shipped in this installation;
real-Pi channel delivery and live remote publication remain untested here.

Pause/cancel apply to the entire composition. Cancellation has no repair route;
Claude subprocess groups observe cancellation/timeouts. Checkpoint waits remain
durable and cannot be answered by the model when protected. Resume retains the
same accepted work and requires the original frozen root/child sources; never
restart an active run merely because definitions changed. Uncertain manual
effects still require inspection/operator recovery. This refactor does not add
or claim general engine recovery; existing terminal recovery and missing-result
reminders remain the runtime's responsibility.
