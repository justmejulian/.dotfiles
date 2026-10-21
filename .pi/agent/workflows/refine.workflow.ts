// Review -> authorized implementation/verify -> review; never intake or publish.
import {
  compute,
  defineWorkflow,
  includedResult,
  includeWorkflow,
} from "@osolmaz/pi-workflows";
import review from "./review.workflow.ts";
import implement from "./implement.workflow.ts";
import {
  object,
  parseAuthority,
  parseBlocked,
  parseImplemented,
  parseReview,
  parseStage,
  loopDecision,
  type Authority,
  type ImplementReady,
  type ReviewReady,
} from "./lib/stages.ts";

type Ready = {
  review: ReviewReady;
  implementation?: ImplementReady;
  rounds: number;
};
export default defineWorkflow({
  name: "refine",
  source: import.meta.url,
  input: (value: unknown) => {
    const v = object(value),
      maxRounds = v.maxRounds ?? 3;
    if (
      !Number.isInteger(maxRounds) ||
      Number(maxRounds) < 0 ||
      Number(maxRounds) > 5
    )
      throw new Error("maxRounds must be 0..5");
    return {
      ...parseStage(value),
      ...(v.authority ? { authority: parseAuthority(v.authority) } : {}),
      maxRounds: Number(maxRounds),
    };
  },
  startAt: "start",
  maxSteps: 250,
  exits: {
    ready: {
      from: "ready",
      validate: (value: unknown): Ready => {
        const v = object(value);
        parseReview(v.review);
        if (v.implementation) parseImplemented(v.implementation);
        return v as Ready;
      },
    },
    blocked: { from: "blocked", validate: parseBlocked },
  },
  includes: {
    review: includeWorkflow(review, {
      input: ({ input: rawInput }) => {
        const input = rawInput as ReturnType<typeof parseStage> & {
          authority?: Authority;
          maxRounds: number;
        };
        return parseStage(input);
      },
    }),
    implement: includeWorkflow(implement, {
      input: ({ input: rawInput, outputs }) => {
        const input = rawInput as ReturnType<typeof parseStage> & {
          authority?: Authority;
          maxRounds: number;
        };
        const current = includedResult(review, outputs.review);
        if (current.exit !== "ready" || !input.authority)
          throw new Error("repair route without validated findings/authority");
        return {
          ...current.output.setup,
          authority: input.authority,
          validatedReview: current.output,
        };
      },
    }),
  },
  nodes: {
    start: compute({ run: () => ({}) }),
    round: compute({
      run: ({ input: rawInput, outputs }) => {
        const input = rawInput as ReturnType<typeof parseStage> & {
          authority?: Authority;
          maxRounds: number;
        };
        const current = includedResult(review, outputs.review);
        if (current.exit !== "ready") throw new Error("invalid review route");
        const prior = outputs.round as
          { count: number; review: ReviewReady } | undefined;
        const count = prior ? prior.count + 1 : 0;
        const authority: Authority | undefined = input.authority;
        const decision = loopDecision(
          count,
          input.maxRounds,
          current.output,
          prior?.review,
        );
        const unauthorized = current.output.blocking.some(
          (f) => !authority?.files.includes(f.file),
        );
        return {
          count,
          review: current.output,
          route:
            decision === "repair" && (!authority || unauthorized)
              ? "blocked"
              : decision,
        };
      },
    }),
    ready: compute({
      run: ({ outputs }) => {
        const round = outputs.round as { count: number; review: ReviewReady };
        const implemented = outputs.implement
          ? includedResult(implement, outputs.implement)
          : undefined;
        return {
          review: round.review,
          rounds: round.count,
          ...(implemented?.exit === "ready"
            ? { implementation: implemented.output }
            : {}),
        };
      },
    }),
    blocked: compute({
      run: ({ outputs }) => ({
        reason:
          "Refinement blocked: missing edit/commit authority, out-of-scope findings, failed review/repair/verification, no progress, or round limit. No planning or publication performed.",
        evidence: outputs,
      }),
    }),
  },
  edges: [
    { from: "start", to: "review" },
    { from: "review.ready", to: "round" },
    { from: "review.blocked", to: "blocked" },
    {
      from: "round",
      switch: {
        on: "$.route",
        cases: { ready: "ready", repair: "implement", blocked: "blocked" },
      },
    },
    { from: "implement.ready", to: "review" },
    { from: "implement.blocked", to: "blocked" },
  ],
});
