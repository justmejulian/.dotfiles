// Full development is a single run composed from independently runnable stages.
import {
  choice,
  compute,
  defineHumanChoices,
  defineWorkflow,
  humanDecision,
  humanDecisionEdge,
  includedResult,
  includeWorkflow,
} from "@osolmaz/pi-workflows";
import plan from "./plan.workflow.ts";
import implement from "./implement.workflow.ts";
import refine from "./refine.workflow.ts";
import publish from "./publish.workflow.ts";
import { retryChoices } from "./lib/nodes.ts";
import {
  parseBlocked,
  type Authority,
  type ImplementReady,
  type StageInput,
} from "./lib/stages.ts";

const choices = defineHumanChoices({
  implement: choice({ label: "Approve plan, edit and commit listed files" }),
  stop: choice({ label: "Stop" }),
});
const planned = (o: Record<string, unknown>) => {
  const result = includedResult(plan, o.plan);
  if (result.exit !== "ready") throw new Error("no approved planning result");
  return result.output;
};
const stage = (o: Record<string, unknown>): StageInput => ({
  ...planned(o).setup,
  scope: { paths: [], includeUncommitted: false },
});
const authority = (o: Record<string, unknown>): Authority => ({
  edit: true,
  commit: true,
  files: [...new Set(planned(o).plan.steps.flatMap((s) => s.files))],
  includeUncommitted: false,
});
function implemented(o: Record<string, unknown>): ImplementReady {
  const refinement = o.refine ? includedResult(refine, o.refine) : undefined;
  if (refinement?.exit === "ready" && refinement.output.implementation)
    return refinement.output.implementation;
  const result = includedResult(implement, o.fix ?? o.implement);
  if (result.exit !== "ready") throw new Error("no verified implementation");
  return result.output;
}
export default defineWorkflow({
  name: "develop",
  source: import.meta.url,
  input: (value): { task: string } => ({
    task: String((value as { task?: string } | null)?.task ?? ""),
  }),
  startAt: "start",
  maxSteps: 600,
  exits: {
    ready: {
      from: "ready",
      validate: (v: unknown): { url: string; head: string } =>
        v as { url: string; head: string },
    },
    blocked: { from: "blocked", validate: parseBlocked },
  },
  includes: {
    plan: includeWorkflow(plan, {
      input: ({ input }) => ({ task: (input as { task: string }).task }),
    }),
    implement: includeWorkflow(implement, {
      input: ({ outputs }) => ({
        ...stage(outputs),
        authority: authority(outputs),
        approved: true as const,
        plan: planned(outputs).plan,
      }),
    }),
    refine: includeWorkflow(refine, {
      input: ({ outputs }) => ({
        ...stage(outputs),
        authority: authority(outputs),
        maxRounds: 3,
      }),
    }),
    publish: includeWorkflow(publish, {
      input: ({ outputs }) => {
        const result = includedResult(refine, outputs.refine);
        if (result.exit !== "ready") throw new Error("no clean refinement");
        return {
          review: result.output.review,
          implementation: implemented(outputs),
        };
      },
    }),
    fix: includeWorkflow(implement, {
      input: ({ outputs }) => {
        const publication = outputs.publish
          ? includedResult(publish, outputs.publish)
          : undefined;
        const instructions =
          publication?.exit === "revise"
            ? publication.output.instructions
            : (outputs.escalation as { input: { instructions: string } }).input
                .instructions;
        return {
          ...stage(outputs),
          authority: authority(outputs),
          approved: true as const,
          plan: {
            summary: "Human-requested fix",
            risks: [],
            steps: [
              {
                title: "Apply requested fix",
                goal: instructions,
                files: authority(outputs).files,
                acceptance: ["Only requested changes"],
                checks: ["Full verify suite"],
              },
            ],
          },
        };
      },
    }),
  },
  nodes: {
    start: compute({ run: () => ({}) }),
    approve_plan: humanDecision({
      audience: "operator",
      choices,
      request: ({ outputs }) => ({
        title: "Approve implementation of this plan?",
        subject: { ...planned(outputs), authority: authority(outputs) },
        presentation: {
          schema: "pi-workflows.decision-presentation.v1",
          summary: planned(outputs).plan.summary,
          blocks: [
            {
              kind: "bullets",
              items: planned(outputs).plan.steps.map(
                (s) => `${s.title}: ${s.goal}`,
              ),
            },
            {
              kind: "paragraph",
              text: `Edit/commit authority is limited to: ${authority(outputs).files.join(", ")}. Existing dirty work is not authorized. Push requires separate approval.`,
            },
          ],
        },
      }),
    }),
    escalation: humanDecision({
      audience: "operator",
      choices: retryChoices,
      request: ({ outputs }) => ({
        title: "Implementation/refinement blocked",
        subject: outputs,
        presentation: {
          schema: "pi-workflows.decision-presentation.v1",
          summary:
            "Saved work is preserved. Stop or give instructions for one bounded fix within the approved files.",
          blocks: [
            {
              kind: "paragraph",
              text: "No push has been authorized. Scope changes require stopping and a new approved plan.",
            },
          ],
        },
      }),
    }),
    ready: compute({
      run: ({ outputs }) => includedResult(publish, outputs.publish).output,
    }),
    blocked: compute({
      run: ({ outputs }) => ({
        reason:
          "Development stopped or blocked. Inspect stage evidence; do not repeat uncertain effects.",
        evidence: outputs,
      }),
    }),
  },
  edges: [
    { from: "start", to: "plan" },
    { from: "plan.ready", to: "approve_plan" },
    { from: "plan.blocked", to: "blocked" },
    humanDecisionEdge({
      from: "approve_plan",
      choices,
      cases: { implement: "implement", stop: "blocked" },
    }),
    { from: "implement.ready", to: "refine" },
    { from: "implement.blocked", to: "escalation" },
    { from: "refine.ready", to: "publish" },
    { from: "refine.blocked", to: "escalation" },
    { from: "publish.ready", to: "ready" },
    { from: "publish.blocked", to: "blocked" },
    { from: "publish.revise", to: "fix" },
    humanDecisionEdge({
      from: "escalation",
      choices: retryChoices,
      cases: { retry: "fix", stop: "blocked" },
    }),
    { from: "fix.ready", to: "refine" },
    { from: "fix.blocked", to: "escalation" },
  ],
});
