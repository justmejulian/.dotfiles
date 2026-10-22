import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  discoverWorkflows, resolveWorkflowRef, WorkflowEngine, WorkflowRunStore,
  type AgentStepRequest, type AgentStepSubmission,
} from "@osolmaz/pi-workflows";
import {
  parseAssessment, parseFrame, parseInvestigationInput, parseResearch,
  type InvestigationResult,
} from "../lib/investigate.ts";

const frame = { question: "Why?", scope: "Read-only fixture", plan: "Compare code and upstream docs" };
const track = { status: "completed", summary: "Checked matching revision/version", evidence: ["fixture.ts:1 at fixture-sha"] };
const research = {
  code: track,
  web: { ...track, evidence: ["https://example.invalid/docs/v1"] },
  internal: { status: "inapplicable", summary: "No internal requirement question", evidence: [] },
};
const answer = { route: "answered", finding: "Supported fixture finding", evidence: ["fixture.ts:1"], uncertainty: [], nextStep: "No further action needed" };
const gap = { ...answer, route: "follow_up", uncertainty: ["Version mismatch"], followUp: "Check installed version" };

async function definition() {
  return (await resolveWorkflowRef("investigate", { cwd: os.tmpdir(), homeDir: os.homedir() })).definition;
}
async function run(options: {
  maxFollowUps?: number;
  failAt?: string;
  timeoutAt?: string;
  cancelAt?: string;
  pauseAt?: string;
  checks?: unknown[];
}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "investigate-workflow-test-"));
  const store = new WorkflowRunStore(path.join(root, "state.sqlite"));
  const workflow = await definition();
  const calls: string[] = [];
  const prompts: string[] = [];
  const checks = [...(options.checks ?? [answer])];
  if (options.timeoutAt) workflow.nodes[options.timeoutAt].timeoutMs = 10;
  let paused = false;
  const engine = new WorkflowEngine({
    store,
    onEvent(event) {
      if (event.type === "node_finished" && event.nodeId === options.pauseAt && !paused) {
        paused = true;
        engine.pause();
        setImmediate(() => engine.resume());
      }
      if (event.type === "node_started" && event.nodeId === options.cancelAt)
        engine.cancel();
    },
    executor: {
      assistantMessageMode: "visible",
      async runAgentStep(request: AgentStepRequest, signal): Promise<AgentStepSubmission> {
        const id = request.contract.nodeId;
        calls.push(id);
        prompts.push(request.prompt);
        if (id === options.failAt) throw new Error("fixture access unavailable");
        if (id === options.timeoutAt)
          return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("fixture aborted")), { once: true });
          });
        if (id === "report") {
          const output = "Finding: fixture report with evidence and limitations.";
          return { output, assistantMessage: { sha256: createHash("sha256").update(output).digest("hex") } };
        }
        const output = id === "frame" ? frame : id === "check" ? checks.shift() : research;
        const accepted = await request.accept(output);
        if (!accepted.ok) throw new Error(accepted.error);
        return { output: accepted.value };
      },
    },
  });
  try {
    const result = await engine.run(workflow, { task: "Explain fixture behavior", maxFollowUps: options.maxFollowUps ?? 2 });
    return { ...result, calls, prompts, paused, output: result.state.finalOutput as InvestigationResult };
  } finally {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("installed global discovery resolves investigate", async () => {
  const workflows = await discoverWorkflows({ cwd: os.tmpdir(), homeDir: os.homedir() });
  assert.ok(workflows.some((workflow) => workflow.name === "investigate"));
  const workflow = await definition();
  assert.equal(workflow.name, "investigate");
  assert.equal(workflow.nodes.report.nodeType, "agent");
});

test("contracts reject malformed or unsupported evidence and bounds", () => {
  assert.throws(() => parseInvestigationInput({ task: " " }), /task/);
  assert.throws(() => parseInvestigationInput({ task: "why", repository: "relative" }), /absolute/);
  for (const maxFollowUps of [-1, 4, 0.5, "2"])
    assert.throws(() => parseInvestigationInput({ task: "why", maxFollowUps }), /maxFollowUps/);
  const normalized = parseInvestigationInput({ task: "why" });
  assert.equal(normalized.maxFollowUps, 2);
  assert.deepEqual(parseInvestigationInput(normalized), normalized);
  assert.throws(() => parseInvestigationInput({ task: "why", typo: true }), /Unknown/);
  assert.throws(() => parseInvestigationInput({ task: "why", constraints: false }), /constraints/);
  assert.throws(() => parseFrame({ ...frame, question: null }), /question/);
  assert.throws(() => parseResearch({ ...research, web: { ...track, evidence: [] } }), /evidence/);
  assert.throws(() => parseResearch({ ...research, code: { ...track, status: "skipped" } }), /status/);
  assert.throws(() => parseAssessment({ ...answer, evidence: [] }), /evidence/);
  assert.throws(() => parseAssessment({ ...gap, followUp: "" }), /followUp/);
  assert.throws(() => parseFrame({ ...frame, scope: "x".repeat(8_000) }), /characters/);
});

test("answered route saves evidence and presents exactly one report", async () => {
  const result = await run({});
  assert.equal(result.state.status, "completed");
  assert.equal(result.output.status, "answered");
  assert.deepEqual(result.calls, ["frame", "research", "check", "report"]);
  assert.deepEqual(result.output.research, research);
  assert.ok(result.prompts.every((prompt) => prompt.includes("read-only")));
  assert.ok(result.prompts.every((prompt) => !prompt.includes("SKILL.md") && !prompt.includes("/skill:")));
  const researchPrompt = result.prompts[result.calls.indexOf("research")];
  for (const instruction of ["code-investigator", "web-researcher", "Use gh CLI", "slack_fetch", "Never pass private"])
    assert.ok(researchPrompt.includes(instruction));
});

test("follow-ups persist evidence and feed it into the next check", async () => {
  const result = await run({ checks: [gap, answer] });
  assert.equal(result.output.status, "answered");
  assert.equal(result.output.followUps.length, 1);
  assert.equal(result.output.followUps[0].request, gap.followUp);
  assert.equal(result.calls.filter((id) => id === "check").length, 2);
  const secondCheck = result.prompts[result.calls.lastIndexOf("check")];
  assert.ok(secondCheck.includes('"request":"Check installed version"'));
});

for (const maxFollowUps of [0, 2, 3])
  test(`unresolved evidence stops after ${maxFollowUps} follow-ups`, async () => {
    const result = await run({ maxFollowUps, checks: Array(maxFollowUps + 1).fill(gap) });
    assert.equal(result.output.status, "needs_evidence");
    assert.equal(result.output.followUps.length, maxFollowUps);
    assert.equal(result.calls.filter((id) => id === "followUp").length, maxFollowUps);
    assert.equal(result.state.status, "completed");
  });

test("explicit blocker returns saved partial research without follow-ups", async () => {
  const result = await run({ checks: [{ ...answer, route: "blocked", uncertainty: ["Missing repository access"] }] });
  assert.equal(result.output.status, "blocked");
  assert.deepEqual(result.output.research, research);
  assert.ok(!result.calls.includes("followUp"));
});

for (const failAt of ["frame", "research", "check", "followUp"])
  test(`failed ${failAt} reports a blocker without retrying research`, async () => {
    const result = await run({ failAt, checks: [gap] });
    assert.equal(result.state.status, "completed");
    assert.equal(result.output.status, "blocked");
    assert.ok(result.output.assessment.uncertainty.some((item) => item.includes(failAt)));
    assert.equal(result.calls.filter((id) => id === failAt).length, 1);
    assert.equal(result.calls.at(-1), "report");
  });

test("failed report leaves the prepared finding saved for terminal recovery", async () => {
  const result = await run({ failAt: "report" });
  assert.equal(result.state.status, "failed");
  const prepared = result.state.steps.find((step) => step.nodeId === "prepare");
  assert.equal((prepared?.output as InvestigationResult).status, "answered");
  assert.equal(result.calls.filter((id) => id === "report").length, 1);
});

test("timeout routes to a blocked report with accepted research retained", async () => {
  const result = await run({ timeoutAt: "check" });
  assert.equal(result.output.status, "blocked");
  assert.deepEqual(result.output.research, research);
  assert.ok(result.state.steps.some((step) => step.nodeId === "check" && step.outcome === "timed_out"));
});

test("pause/resume retains accepted research without rerunning it", async () => {
  const result = await run({ pauseAt: "research" });
  assert.equal(result.paused, true);
  assert.equal(result.output.status, "answered");
  assert.equal(result.calls.filter((id) => id === "research").length, 1);
});

test("cancellation stays terminal with no report or recovery branch", async () => {
  const result = await run({ cancelAt: "check" });
  assert.equal(result.state.status, "cancelled");
  assert.ok(!result.calls.includes("report"));
});
