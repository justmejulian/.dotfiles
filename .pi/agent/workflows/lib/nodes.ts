// Workflow pieces shared by develop and address-feedback: the orchestrator
// voice, escalations, retry gates, implementer briefs, verify with in-place
// fixes, and the final review with its skeptical finding check.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  action,
  agent,
  choice,
  compute,
  defineHumanChoices,
  humanDecision,
  manualEffect,
  shell,
  textInput,
} from "@osolmaz/pi-workflows";
import { runClaude } from "./claude.ts";
import { git, hasSkill, notify, recordPiUsage, verifyCommand, writeJson } from "./develop.ts";

export const MINUTE = 60_000;
export const MAX_ATTEMPTS = 3;

/** Run facts every workflow keeps in outputs.setup. */
export type Setup = {
  repository: string;
  branch: string;
  /** Fixed point for reviews: merge-base (develop) or the last pushed commit (address-feedback). */
  base: string;
  piPane: string;
  runDir: string;
  /** What the reviewers check against. */
  task: string;
};

export type Finding = {
  id: string;
  source: "spec" | "standards" | "review-changes" | "clean-code";
  severity: string;
  file: string;
  line: number | null;
  problem: string;
  requiredChange: string;
  documentedRule: boolean;
};

type Outputs = Record<string, unknown>;

export const setupOf = (outputs: Outputs) => outputs.setup as Setup;

/** Record pi usage (orchestrator and sub-agents) since the last call. */
export function trackPi(outputs: Outputs) {
  const setup = setupOf(outputs);
  if (setup) recordPiUsage(setup.runDir, setup.repository);
}

export const ORCHESTRATOR = `You are the orchestrator of this workflow. You coordinate the planner and reviewers (Claude) and the pi implementer sub-agent, and answer their questions yourself. Before deciding anything, check how the repo already does the same thing and follow that. Avoid over-engineering. Only involve me for product behaviour, scope, or tradeoffs where my preference matters.`;

export const IMPLEMENTER_RESULT = `{ "status": "done" | "needs_answer" | "failed", "commit": "<sha or null>", "summary": "...", "checks": [{ "command": "...", "result": "passed" | "failed" }], "notes": "..." }`;

// --- JSON schema helpers -----------------------------------------------------

export const str = { type: "string" };
export const strs = { type: "array", items: str };
export const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const reviewSchema = obj({
  summary: str,
  findings: {
    type: "array",
    items: obj({
      id: str,
      source: { type: "string", enum: ["spec", "standards", "review-changes", "clean-code"] },
      severity: str,
      file: str,
      line: { type: ["integer", "null"] },
      problem: str,
      requiredChange: str,
      documentedRule: { type: "boolean" },
    }),
  },
});

export const checkSchema = obj({
  items: { type: "array", items: obj({ id: str, decision: { type: "string", enum: ["fix", "skip"] }, reason: str }) },
});

/** The skeptical check from the design: real, in scope, proportionate. */
export const CHECK_RULES = `Be skeptical. Keep an item only if it is:
- real: a concrete failing input or code path in this branch, not "could theoretically";
- in scope: about this branch's change;
- worth it: the fix is proportionate, with no new abstractions, options or flexibility just in case.
Verify each claim in the code (use workflow-explorer). Give a one-line reason.`;

// --- Human decisions -----------------------------------------------------------

export const retryChoices = defineHumanChoices({
  retry: choice({ label: "Retry", input: textInput({ name: "instructions", prompt: "What should change?" }) }),
  stop: choice({ label: "Stop the run" }),
});

export const pushChoices = defineHumanChoices({
  push: choice({ label: "Push" }),
  fix: choice({ label: "Fix first", input: textInput({ name: "instructions", prompt: "What should be fixed?" }) }),
  stop: choice({ label: "Stop the run" }),
});

export function escalation(workflow: string, title: string, summary: (outputs: Outputs) => string) {
  return humanDecision({
    audience: "operator",
    choices: retryChoices,
    request: ({ outputs }) => {
      const text = summary(outputs);
      notify(`${workflow}: ${title}`, text.slice(0, 200));
      return {
        title,
        subject: { summary: text },
        presentation: {
          schema: "pi-workflows.decision-presentation.v1",
          summary: text,
          blocks: [{ kind: "paragraph", text: `Run files: ${setupOf(outputs).runDir}` }],
        },
      };
    },
  });
}

/** Counter that resets after escalating, so a retry gets a fresh 3 attempts. */
export function attemptGate(gate: string, failed: (outputs: Outputs) => boolean, okRoute: string, failRoute: string) {
  return compute({
    run: ({ outputs }) => {
      const previous = (outputs[gate] as { attempts?: number } | undefined)?.attempts ?? 0;
      if (!failed(outputs)) return { route: okRoute, attempts: 0 };
      const attempts = previous + 1;
      return attempts >= MAX_ATTEMPTS ? { route: "escalate", attempts: 0 } : { route: failRoute, attempts };
    },
  });
}

/** My TypeScript clean code rules; applied when a change touches TypeScript. */
export const CLEAN_CODE_GUIDE = path.join(os.homedir(), ".pi/agent/skills/clean-code/typescript-clean-code.md");

function touchesTypeScript(setup: Setup) {
  return git(setup.repository, "diff", "--name-only", `${setup.base}...HEAD`)
    .split("\n")
    .some((file) => /\.(ts|tsx|mts|cts)$/.test(file));
}

// --- Implementer ---------------------------------------------------------------

export function implementPrompt(setup: Setup, brief: string) {
  return `${ORCHESTRATOR}

Call the implementer sub-agent once and wait for it. Give it this brief:

---
${brief}

Repository: ${setup.repository}. Follow its conventions and skills. For TypeScript, also follow the clean code rules in ${CLEAN_CODE_GUIDE}; where they conflict with the repo's conventions, the repo wins. Run the checks that cover your change; the full verify suite runs after every commit.
---

If it asks you something with caller_ping, answer from the task, plan, decisions and repo precedent, then resume it. Ask me only if you truly can't decide. When it finishes, submit its final JSON unchanged.`;
}

/** An implementer step whose brief is built from the outputs. */
export function implementNode(statusDetail: string, brief: (outputs: Outputs) => string) {
  return agent({
    statusDetail,
    timeoutMs: 90 * MINUTE,
    prompt: ({ outputs }) => implementPrompt(setupOf(outputs), brief(outputs)),
    expectedOutput: IMPLEMENTER_RESULT,
  });
}

/** After an implementer step: record pi usage, then verify or escalate. */
export function implementGate(effect: string, node: string) {
  return action({
    effect: manualEffect(effect),
    run: ({ outputs }) => {
      trackPi(outputs);
      return { route: (outputs[node] as { status: string }).status === "done" ? "verify" : "escalate" };
    },
  });
}

// --- Verify ----------------------------------------------------------------------

export function verifyNode(effect: string) {
  return shell({
    effect: manualEffect(effect),
    statusDetail: "running the full verify suite",
    timeoutMs: 180 * MINUTE,
    exec: ({ outputs }) => {
      const setup = setupOf(outputs);
      const command = verifyCommand(setup.repository);
      return {
        command: "bash",
        args: ["-lc", command ?? `echo "no verify.conf line for this repo"; exit 0`],
        cwd: setup.repository,
        timeoutMs: 180 * MINUTE,
        allowNonZeroExit: true,
      };
    },
    parse: (result) => ({
      passed: result.exitCode === 0 && result.signal === null && result.stdout.length < 1_000_000 && result.stderr.length < 1_000_000,
      tail: `${result.stdout}\n${result.stderr}`.trim().split("\n").slice(-120).join("\n"),
    }),
  });
}

/** Fix a failing commit in place, so every commit passes the suite on its own. */
export function fixVerifyNode(context: (outputs: Outputs) => string) {
  return implementNode(
    "fixing verify failures",
    (outputs) => `Fix-up step: the full verify suite failed after the latest commit. Fix the failures this branch caused (use fixer first for mechanical lint/type/format errors) and amend the latest commit with the fix (git commit --amend --no-edit), so every commit passes the suite on its own. Don't create a new commit. If a failure is unrelated to this branch, don't touch it; say so in notes.

Verify output (last lines):
${(outputs.verify as { tail: string }).tail}

Context:
${context(outputs)}`,
  );
}

// --- Final review ------------------------------------------------------------------

export function finalReviewNode(effect: string, scope: (outputs: Outputs) => string = (o) => `git diff ${setupOf(o).base}...HEAD; committed changes only`) {
  return action({
    effect: manualEffect(effect),
    statusDetail: "final review",
    timeoutMs: 60 * MINUTE,
    run: async ({ outputs, signal }) => {
      trackPi(outputs);
      const setup = setupOf(outputs);
      const repoReview = hasSkill(setup.repository, "review-changes");
      const cleanCode = touchesTypeScript(setup) && fs.existsSync(CLEAN_CODE_GUIDE) ? fs.readFileSync(CLEAN_CODE_GUIDE, "utf8") : "";
      const result = await runClaude<{ summary: string; findings: Finding[] }>({
        role: "finalReview",
        signal,
        cwd: setup.repository,
        runDir: setup.runDir,
        schema: reviewSchema,
        prompt: `Final review.

${scope(outputs)}
Scope instructions above override any skill default (including base...HEAD). Review exactly those changes, including working-tree changes when requested.

1. Use the Skill tool to run mattpocock-skills:code-review with fixed point ${setup.base}. The spec is the task below; don't look for another spec and don't ask for one.
${repoReview ? `2. Use the Skill tool to run the repo's review-changes skill with base ${setup.base}.` : ""}
${cleanCode ? `3. Review the TypeScript changes in git diff ${setup.base}...HEAD against the clean code rules below. Cite the rule number in each finding's problem (e.g. "G25: magic number 86400"). Where a rule conflicts with the repo's documented conventions or its clear existing patterns, the repo wins: don't report it. Only report violations introduced by this branch.

<clean-code-rules>
${cleanCode}
</clean-code-rules>` : ""}

Return every finding. source is "spec" or "standards" for code-review findings, "review-changes" for the repo skill and "clean-code" for the clean code rules. severity: for review-changes use blocker/suggestion/nit; for standards say whether it's a documented-rule breach or a smell. documentedRule is true only when the finding cites a rule written in the repo's docs.

Task (the spec):
${setup.task}`,
      });
      writeJson(path.join(setup.runDir, `final-review-${Date.now()}.json`), result.output);
      return result.output;
    },
  });
}

/** Skeptical check; spec, clean-code, documented-rule and blocker findings block. */
export function checkFindingsNode(effect: string, scope: (outputs: Outputs) => string = (o) => `git diff ${setupOf(o).base}...HEAD; committed changes only`) {
  return action({
    effect: manualEffect(effect),
    statusDetail: "checking review findings",
    timeoutMs: 30 * MINUTE,
    run: async ({ outputs, signal }) => {
      trackPi(outputs);
      const setup = setupOf(outputs);
      const review = outputs.final_review as { findings: Finding[] };
      if (review.findings.length === 0) return { blocking: [], noted: [], skipped: [], evidence: [] };
      const result = await runClaude<{ items: { id: string; decision: "fix" | "skip"; reason: string }[] }>({
        role: "checker",
        signal,
        cwd: setup.repository,
        runDir: setup.runDir,
        schema: checkSchema,
        prompt: `For each review finding below decide "fix" or "skip".

${scope(outputs)}
Give exactly one decision per finding; cite concrete code evidence in each reason.

${CHECK_RULES}

Task (the same spec as the reviewer):
${setup.task}

${JSON.stringify(review.findings, null, 2)}`,
      });
      const ids = review.findings.map((f) => f.id);
      const items = result.output.items;
      if (new Set(ids).size !== ids.length || items.length !== ids.length || new Set(items.map((i) => i.id)).size !== ids.length || items.some((i) => !ids.includes(i.id) || !["fix", "skip"].includes(i.decision) || !i.reason.trim()))
        throw new Error("checker must cover every finding exactly once with evidence");
      const fix = new Set(result.output.items.filter((i) => i.decision === "fix").map((i) => i.id));
      const blocks = (f: Finding) =>
        f.source === "spec" ||
        f.source === "clean-code" ||
        (f.source === "standards" && f.documentedRule) ||
        (f.source === "review-changes" && /blocker/i.test(f.severity));
      writeJson(path.join(setup.runDir, `checked-findings-${Date.now()}.json`), {
        items: result.output.items,
        findings: review.findings,
      });
      return {
        blocking: review.findings.filter((f) => fix.has(f.id) && blocks(f)),
        noted: review.findings.filter((f) => fix.has(f.id) && !blocks(f)),
        skipped: result.output.items.filter((i) => i.decision === "skip"),
        evidence: result.output.items,
      };
    },
  });
}

export function fixReviewNode(context: (outputs: Outputs) => string) {
  return implementNode("fixing review findings", (outputs) => {
    const blocking = (outputs.check_findings as { blocking: Finding[] }).blocking;
    return `Fix-up step: address these confirmed review findings with one commit, minimally:
${blocking.map((f) => `- ${f.file}${f.line ? `:${f.line}` : ""}: ${f.problem} → ${f.requiredChange}`).join("\n")}

Context:
${context(outputs)}`;
  });
}

export function fixEscalation(workflow: string) {
  return escalation(workflow, "Fixes didn't converge", (o) => {
    const verify = o.verify as { passed: boolean; tail: string } | undefined;
    const blocking = (o.check_findings as { blocking: Finding[] } | undefined)?.blocking ?? [];
    return verify && !verify.passed
      ? `Verify still fails after ${MAX_ATTEMPTS} fix attempts:\n${verify.tail.split("\n").slice(-15).join("\n")}`
      : `Review findings still open after ${MAX_ATTEMPTS} attempts:\n${blocking.map((f) => `- ${f.problem}`).join("\n")}`;
  });
}

/** Fix-up from my instructions (push decision or escalation). */
export function fixUserNode(context: (outputs: Outputs) => string, decisions: string[]) {
  return implementNode("applying your fixes", (outputs) => {
    const instructions =
      decisions
        .map((node) => (outputs[node] as { input?: { instructions?: string } } | undefined)?.input?.instructions)
        .find(Boolean) ?? "";
    return `Fix-up step from me. Do exactly this, as one commit:
${instructions}

Context:
${context(outputs)}`;
  });
}

/** Wrap-up action: records final pi usage and runs an optional cleanup. */
export function wrapNode(effect: string, cleanup?: (outputs: Outputs) => void) {
  return action({
    effect: manualEffect(effect),
    run: ({ outputs }) => {
      trackPi(outputs);
      cleanup?.(outputs);
      return { ok: true };
    },
  });
}

export function commitsSince(setup: Setup): string[] {
  return git(setup.repository, "log", "--oneline", `${setup.base}..HEAD`).split("\n").filter(Boolean);
}
