// Approved work only; bounded implementation + full-suite verification per commit.
import {
  action,
  compute,
  defineWorkflow,
  idempotentEffect,
} from "@osolmaz/pi-workflows";
import { git, verifyCommand } from "./lib/develop.ts";
import {
  IMPLEMENTER_RESULT,
  implementNode,
  implementPrompt,
  MINUTE,
  verifyNode,
} from "./lib/nodes.ts";
import {
  guard,
  object,
  observe,
  parseAuthority,
  parseBlocked,
  parseImplemented,
  parsePlan,
  parseReview,
  parseRevision,
  parseStage,
  prepare,
  repairPlan,
  unrelatedChanged,
  type Authority,
  type Plan,
  type Prepared,
  type Revision,
  type ReviewReady,
  type StageInput,
} from "./lib/stages.ts";

type Input = StageInput & { authority: Authority } & (
    | { approved: true; plan: Plan; expectedRevision?: Revision }
    | { validatedReview: ReviewReady }
  );
const planOf = (input: Input) =>
  "validatedReview" in input
    ? repairPlan(input.validatedReview.blocking, input.task)
    : input.plan;
const revisionOf = (input: Input) =>
  "validatedReview" in input
    ? input.validatedReview.revision
    : input.expectedRevision;
function parseInput(value: unknown): Input {
  const v = object(value),
    stage = parseStage(value);
  const review = v.validatedReview ? parseReview(v.validatedReview) : undefined;
  if (!review && v.approved !== true)
    throw new Error(
      "an explicitly approved plan or validated review is required",
    );
  const plan = review
    ? repairPlan(review.blocking, stage.task)
    : parsePlan(v.plan);
  if (!plan.steps[0]?.files.length)
    throw new Error("no actionable validated findings");
  const common = { ...stage, authority: parseAuthority(v.authority) };
  if (review) return { ...common, validatedReview: review };
  return {
    ...common,
    plan,
    approved: true,
    ...(v.expectedRevision
      ? { expectedRevision: parseRevision(v.expectedRevision) }
      : {}),
  };
}
const setupOf = (o: Record<string, unknown>) => o.setup as Prepared;
const cursor = (o: Record<string, unknown>) =>
  o.next as { index: number; revision: Revision };
const attempts = (o: Record<string, unknown>) =>
  (o.verify_gate as { attempts?: number } | undefined)?.attempts ?? 0;
const brief = (input: Input, o: Record<string, unknown>, repair = false) => {
  const step = planOf(input).steps[cursor(o).index];
  return `${repair ? `Fix verification failures and amend ONLY the latest workflow-owned commit with --no-edit (no new commit).\n${JSON.stringify(o.verify)}` : `Implement this one approved step as exactly one atomic commit:\n${JSON.stringify(step)}`}
Task: ${input.task}
Authority: edit and commit ONLY these literal files: ${JSON.stringify(input.authority.files)}.
${input.authority.includeUncommitted ? "Existing uncommitted changes in those files are explicitly authorized for inclusion." : "Do not include preexisting dirty work."}
Unrelated dirty work must remain byte-for-byte unchanged and unstaged. Never git add -A, git add ., reset, stash, clean, checkout other files, push, publish, merge, delete branches, launch the app, or change branch.
Stop with needs_answer for out-of-scope files, behavior or decisions. Do not infer more authority from the task.
Run the full verify suite before committing; every commit must pass on its own. Use repo skills. ${repair ? "Use fixer once for mechanical lint/type/format errors." : "Do not amend existing commits."}`;
};
export default defineWorkflow({
  name: "implement",
  source: import.meta.url,
  input: parseInput,
  startAt: "setup",
  maxSteps: 100,
  exits: {
    ready: { from: "ready", validate: parseImplemented },
    blocked: { from: "blocked", validate: parseBlocked },
  },
  nodes: {
    setup: action({
      effect: idempotentEffect("implement.setup"),
      timeoutMs: MINUTE,
      run: ({ input, state }) => prepare(input as Input, state.runId),
    }),
    guard: action({
      effect: idempotentEffect("implement.guard"),
      timeoutMs: MINUTE,
      run: ({ input: rawInput, outputs }) => {
        const input = rawInput as Input;
        const setup = setupOf(outputs),
          revision = observe(setup);
        const outside = planOf(input)
          .steps.flatMap((s) => s.files)
          .find((f) => !input.authority.files.includes(f));
        const expectedRevision = revisionOf(input);
        const reason =
          guard(setup, revision, input.authority) ??
          (outside ? `plan file outside authority: ${outside}` : null) ??
          (!verifyCommand(setup.repository)
            ? "no full verify suite configured in verify.conf"
            : null) ??
          (expectedRevision &&
          JSON.stringify(expectedRevision) !== JSON.stringify(revision)
            ? "review revision is stale"
            : null);
        return { route: reason ? "blocked" : "next", reason, revision };
      },
    }),
    next: action({
      effect: idempotentEffect("implement.next"),
      timeoutMs: MINUTE,
      run: ({ input: rawInput, outputs }) => {
        const input = rawInput as Input;
        const index =
          ((outputs.next as { index: number } | undefined)?.index ?? -1) + 1;
        const revision = observe(setupOf(outputs));
        const expected =
          index > 0
            ? (outputs.audit as { revision: Revision }).revision
            : (outputs.guard as { revision: Revision }).revision;
        const reason =
          JSON.stringify(revision) !== JSON.stringify(expected)
            ? "repository changed since approval/verification"
            : guard(setupOf(outputs), revision, input.authority);
        const commits = [
          ...((outputs.next as { commits: string[] } | undefined)?.commits ??
            []),
          ...(index > 0 ? [revision.head] : []),
        ];
        return {
          index,
          commits,
          reason,
          route: reason
            ? "blocked"
            : index < planOf(input).steps.length
              ? "implement"
              : "ready",
          revision,
        };
      },
    }),
    implement: {
      ...implementNode("implementing approved work", () => ""),
      prompt: ({ input, outputs }) =>
        implementPrompt(setupOf(outputs), brief(input as Input, outputs)),
      expectedOutput: IMPLEMENTER_RESULT,
    },
    audit: action({
      effect: idempotentEffect("implement.audit"),
      timeoutMs: MINUTE,
      run: ({ input: rawInput, outputs }) => {
        const input = rawInput as Input;
        const before = cursor(outputs).revision,
          after = observe(setupOf(outputs));
        const result = (
          attempts(outputs) > 0 ? outputs.fix_verify : outputs.implement
        ) as { status: string; commit: string | null };
        const changed = git(
          input.repository,
          "diff",
          "--no-renames",
          "--name-only",
          before.head,
          after.head,
          "--",
        )
          .split("\n")
          .filter(Boolean);
        const reason =
          result.status !== "done"
            ? "implementer failed or needs a scope decision"
            : after.head === before.head || result.commit !== after.head
              ? "no matching new commit"
              : git(
                    input.repository,
                    "rev-list",
                    "--parents",
                    "-n",
                    "1",
                    after.head,
                  ) !== `${after.head} ${before.head}`
                ? "expected exactly one atomic commit"
                : after.branch !== before.branch ||
                    after.staged.length ||
                    changed.some((f) => !input.authority.files.includes(f)) ||
                    unrelatedChanged(before, after, input.authority)
                  ? "implementation changed unauthorized state"
                  : input.authority.files.some((f) => after.dirty[f])
                    ? "authorized changes left uncommitted"
                    : null;
        return {
          route: reason ? "blocked" : "verify",
          reason,
          revision: after,
        };
      },
    }),
    verify: verifyNode("implement.verify"),
    verify_gate: compute({
      run: ({ outputs }) => {
        if ((outputs.verify as { passed: boolean }).passed)
          return { route: "next", attempts: 0 };
        const n = attempts(outputs) + 1;
        return { route: n > 2 ? "blocked" : "fix", attempts: n };
      },
    }),
    repair_guard: action({
      effect: idempotentEffect("implement.repair-guard"),
      timeoutMs: MINUTE,
      run: ({ outputs }) => ({
        route:
          JSON.stringify(observe(setupOf(outputs))) ===
          JSON.stringify((outputs.audit as { revision: Revision }).revision)
            ? "fix"
            : "blocked",
      }),
    }),
    fix_verify: {
      ...implementNode("fixing verification", () => ""),
      prompt: ({ input, outputs }) =>
        implementPrompt(setupOf(outputs), brief(input as Input, outputs, true)),
    },
    ready: compute({
      run: ({ outputs }) => ({
        setup: outputs.setup,
        revision: cursor(outputs).revision,
        verification: outputs.verify,
        commits: (outputs.next as { commits: string[] }).commits,
      }),
    }),
    blocked: compute({
      run: ({ outputs, results }) => ({
        reason:
          (outputs.audit as { reason?: string } | undefined)?.reason ??
          (outputs.guard as { reason?: string } | undefined)?.reason ??
          "Implementation or full verification failed; bounded repairs exhausted or scope decision required.",
        evidence: results,
      }),
    }),
  },
  edges: [
    {
      from: "setup",
      switch: {
        on: "$result.outcome",
        cases: { ok: "guard", failed: "blocked", timed_out: "blocked" },
      },
    },
    {
      from: "guard",
      switch: { on: "$.route", cases: { next: "next", blocked: "blocked" } },
    },
    {
      from: "next",
      switch: {
        on: "$.route",
        cases: { implement: "implement", ready: "ready", blocked: "blocked" },
      },
    },
    {
      from: "implement",
      switch: {
        on: "$result.outcome",
        cases: { ok: "audit", failed: "blocked", timed_out: "blocked" },
      },
    },
    {
      from: "audit",
      switch: {
        on: "$.route",
        cases: { verify: "verify", blocked: "blocked" },
      },
    },
    {
      from: "verify",
      switch: {
        on: "$result.outcome",
        cases: { ok: "verify_gate", failed: "blocked", timed_out: "blocked" },
      },
    },
    {
      from: "verify_gate",
      switch: {
        on: "$.route",
        cases: { next: "next", fix: "repair_guard", blocked: "blocked" },
      },
    },
    {
      from: "repair_guard",
      switch: {
        on: "$.route",
        cases: { fix: "fix_verify", blocked: "blocked" },
      },
    },
    {
      from: "fix_verify",
      switch: {
        on: "$result.outcome",
        cases: { ok: "audit", failed: "blocked", timed_out: "blocked" },
      },
    },
  ],
});
