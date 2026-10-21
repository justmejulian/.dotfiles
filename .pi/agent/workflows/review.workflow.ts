// Read-only review + skeptical validation. No repair or publication routes.
import {
  action,
  compute,
  defineWorkflow,
  idempotentEffect,
} from "@osolmaz/pi-workflows";
import { checkFindingsNode, finalReviewNode, MINUTE } from "./lib/nodes.ts";
import {
  observe,
  parseBlocked,
  parseReview,
  parseStage,
  prepare,
  scopeText,
  type Checked,
  type Prepared,
  type Revision,
} from "./lib/stages.ts";

const scope = (o: Record<string, unknown>) =>
  scopeText(o.setup as Prepared, o.snapshot as Revision);
export default defineWorkflow({
  name: "review",
  source: import.meta.url,
  input: parseStage,
  startAt: "setup",
  maxSteps: 8,
  exits: {
    ready: { from: "ready", validate: parseReview },
    blocked: { from: "blocked", validate: parseBlocked },
  },
  nodes: {
    setup: action({
      effect: idempotentEffect("review.setup"),
      timeoutMs: MINUTE,
      run: ({ input, state }) => prepare(parseStage(input), state.runId),
    }),
    snapshot: action({
      effect: idempotentEffect("review.snapshot"),
      timeoutMs: MINUTE,
      run: ({ outputs }) => observe(outputs.setup as Prepared),
    }),
    final_review: finalReviewNode("review.final", scope),
    check_findings: checkFindingsNode("review.check", scope),
    unchanged: action({
      effect: idempotentEffect("review.unchanged"),
      timeoutMs: MINUTE,
      run: ({ outputs }) => ({
        route:
          JSON.stringify(observe(outputs.setup as Prepared)) ===
          JSON.stringify(outputs.snapshot)
            ? "ready"
            : "blocked",
      }),
    }),
    ready: compute({
      run: ({ outputs }) => ({
        ...(outputs.check_findings as Checked),
        setup: outputs.setup,
        revision: outputs.snapshot,
        summary: (outputs.final_review as { summary: string }).summary,
      }),
    }),
    blocked: compute({
      run: ({ results }) => ({
        reason:
          "Review incomplete, failed, timed out, or repository changed during review; no repair authorized.",
        evidence: results,
      }),
    }),
  },
  edges: [
    {
      from: "setup",
      switch: {
        on: "$result.outcome",
        cases: { ok: "snapshot", failed: "blocked", timed_out: "blocked" },
      },
    },
    {
      from: "snapshot",
      switch: {
        on: "$result.outcome",
        cases: { ok: "final_review", failed: "blocked", timed_out: "blocked" },
      },
    },
    {
      from: "final_review",
      switch: {
        on: "$result.outcome",
        cases: {
          ok: "check_findings",
          failed: "blocked",
          timed_out: "blocked",
        },
      },
    },
    {
      from: "check_findings",
      switch: {
        on: "$result.outcome",
        cases: { ok: "unchanged", failed: "blocked", timed_out: "blocked" },
      },
    },
    {
      from: "unchanged",
      switch: { on: "$.route", cases: { ready: "ready", blocked: "blocked" } },
    },
  ],
});
