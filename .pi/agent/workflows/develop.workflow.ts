// /workflow develop <LINEAR-ID and/or task notes>
//
// Plans, implements and reviews one task in the current worktree, then pushes
// and opens a draft PR after my approval. pi (this session) orchestrates;
// Claude plans and reviews headless (lib/claude.ts); the pi `implementer`
// sub-agent writes the code. Run files: ~/.pi/agent/workflows/runs/<repo>/<run>.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  action,
  agent,
  checkpoint,
  choice,
  compute,
  defineHumanChoices,
  defineWorkflow,
  humanDecision,
  humanDecisionEdge,
  manualEffect,
  notify as notifyNode,
  shell,
  textInput,
} from "@osolmaz/pi-workflows";
import { newSessionId, runClaude } from "./lib/claude.ts";
import {
  type Decision,
  git,
  hasSkill,
  loadInterview,
  notify,
  renderDecisions,
  runDirFor,
  saveInterview,
  verifyCommand,
  writeJson,
} from "./lib/develop.ts";

const MAX_ROUNDS = 5;
const MAX_ATTEMPTS = 3;
const MINUTE = 60_000;

type Start = { repository: string; base: string; branch: string; linearId: string | null; notes: string; piPane: string };
type Setup = Start & { runDir: string; task: string };
type Step = { title: string; goal: string; files: string[]; acceptance: string[]; checks: string[] };
type Plan = { summary: string; steps: Step[]; risks: string[] };
type Finding = {
  id: string;
  source: "spec" | "standards" | "review-changes";
  severity: string;
  file: string;
  line: number | null;
  problem: string;
  requiredChange: string;
  documentedRule: boolean;
};

const setupOf = (outputs: Record<string, unknown>) => outputs.setup as Setup;
const planOf = (outputs: Record<string, unknown>) => outputs.plan as Plan;

const ORCHESTRATOR = `You are the orchestrator of the develop workflow. You coordinate the planner (Claude), the pi implementer sub-agent and the reviewers, and answer their questions yourself. Before deciding anything, check how the repo already does the same thing and follow that. Avoid over-engineering. Only involve me for product behaviour, scope, or tradeoffs where my preference matters.`;

const IMPLEMENTER_RESULT = `{ "status": "done" | "needs_answer" | "failed", "commit": "<sha or null>", "summary": "...", "checks": [{ "command": "...", "result": "passed" | "failed" }], "notes": "..." }`;

// --- JSON schemas for Claude's answers -------------------------------------

const str = { type: "string" };
const strs = { type: "array", items: str };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const intakeSchema = obj({ title: str, description: str, comments: strs, links: strs });
const roundSchema = obj({
  status: { type: "string", enum: ["questions", "done"] },
  decided: { type: "array", items: obj({ question: str, answer: str, reason: str, precedent: str }) },
  questions: { type: "array", items: obj({ question: str, recommendation: str, precedent: str }) },
});
const planSchema = obj({
  summary: str,
  steps: { type: "array", items: obj({ title: str, goal: str, files: strs, acceptance: strs, checks: strs }) },
  risks: strs,
});
const planVerdictSchema = obj({
  verdict: { type: "string", enum: ["approved", "rejected"] },
  findings: { type: "array", items: obj({ severity: str, problem: str, requiredChange: str }) },
});
const reviewSchema = obj({
  summary: str,
  findings: {
    type: "array",
    items: obj({
      id: str,
      source: { type: "string", enum: ["spec", "standards", "review-changes"] },
      severity: str,
      file: str,
      line: { type: ["integer", "null"] },
      problem: str,
      requiredChange: str,
      documentedRule: { type: "boolean" },
    }),
  },
});
const checkSchema = obj({
  items: { type: "array", items: obj({ id: str, decision: { type: "string", enum: ["fix", "skip"] }, reason: str }) },
});
const prSchema = obj({ url: str });

// --- Human decisions ---------------------------------------------------------

const retryChoices = defineHumanChoices({
  retry: choice({ label: "Retry", input: textInput({ name: "instructions", prompt: "What should change?" }) }),
  stop: choice({ label: "Stop the run" }),
});
const pushChoices = defineHumanChoices({
  push: choice({ label: "Push and open a draft PR" }),
  fix: choice({ label: "Fix first", input: textInput({ name: "instructions", prompt: "What should be fixed?" }) }),
  stop: choice({ label: "Stop the run" }),
});

function escalation(title: string, summary: (outputs: Record<string, unknown>) => string) {
  return humanDecision({
    audience: "operator",
    choices: retryChoices,
    request: ({ outputs }) => {
      const text = summary(outputs);
      notify(`develop: ${title}`, text.slice(0, 200));
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
function attemptGate(gate: string, failed: (outputs: Record<string, unknown>) => boolean, okRoute: string, failRoute: string) {
  return compute({
    run: ({ outputs }) => {
      const previous = (outputs[gate] as { attempts?: number } | undefined)?.attempts ?? 0;
      if (!failed(outputs)) return { route: okRoute, attempts: 0 };
      const attempts = previous + 1;
      return attempts >= MAX_ATTEMPTS ? { route: "escalate", attempts: 0 } : { route: failRoute, attempts };
    },
  });
}

function implementPrompt(setup: Setup, brief: string) {
  return `${ORCHESTRATOR}

Call the implementer sub-agent once and wait for it. Give it this brief:

---
${brief}

Repository: ${setup.repository}. Follow its conventions and skills. Run the checks that cover your change; the full verify suite runs later.
---

If it asks you something with caller_ping, answer from the task, plan, decisions and repo precedent, then resume it. Ask me only if you truly can't decide. When it finishes, submit its final JSON unchanged.`;
}

function taskContext(setup: Setup, plan?: Plan) {
  const parts = [`Task:\n${setup.task}`];
  if (plan) parts.push(`Plan summary: ${plan.summary}`);
  const decisions = loadInterview(setup.runDir).decisions.filter((d) => d.answer);
  if (decisions.length) parts.push(`Decisions:\n${decisions.map((d) => `- ${d.question} → ${d.answer}`).join("\n")}`);
  return parts.join("\n\n");
}

// --- Workflow ----------------------------------------------------------------

export default defineWorkflow({
  name: "develop",
  title: ({ input }) => `develop: ${String((input as { task?: string }).task ?? "").slice(0, 60)}`,
  startAt: "start",
  maxSteps: 400,
  nodes: {
    // pi knows where it runs; the workflow server doesn't.
    start: agent({
      statusDetail: "reading the repo and task",
      prompt: ({ input }) => `${ORCHESTRATOR}

Prepare the develop workflow for this request: ${JSON.stringify((input as { task?: string }).task ?? "")}

Run \`git rev-parse --show-toplevel\`, \`git branch --show-current\`, \`git merge-base HEAD origin/main\` (fall back to the repo's default branch) and \`echo $HERDR_PANE_ID\`. Split the request into a Linear issue ID (like VIZ-123, if present) and my notes (the rest).`,
      expectedOutput: `{ "repository": "<absolute repo root>", "branch": "...", "base": "<merge-base sha>", "linearId": "<ID or null>", "notes": "...", "piPane": "<HERDR_PANE_ID>" }`,
      validate: (output) => {
        const start = output as Start;
        if (!path.isAbsolute(start.repository) || !fs.existsSync(path.join(start.repository, ".git")))
          throw new Error("repository must be the absolute git root");
        if (start.branch === "main" || start.branch === "master") throw new Error("refusing to work on the default branch");
        return start;
      },
    }),

    setup: action({
      effect: manualEffect("develop.setup"),
      statusDetail: "fetching the Linear issue",
      timeoutMs: 10 * MINUTE,
      run: async ({ outputs, state }) => {
        const start = outputs.start as Start;
        const runDir = runDirFor(start.repository, state.runId);
        let task = start.notes;
        if (start.linearId) {
          const issue = await runClaude<{ title: string; description: string; comments: string[]; links: string[] }>({
            role: "intake",
            cwd: start.repository,
            runDir,
            schema: intakeSchema,
            prompt: `Fetch Linear issue ${start.linearId} with the Linear tools: title, description, comments (oldest first, each prefixed with the author) and links (PRs, docs, designs). Return them verbatim, without summarising.`,
          });
          const ticket = issue.output;
          task = [
            `${start.linearId}: ${ticket.title}`,
            ticket.description,
            ticket.comments.length ? `Comments:\n${ticket.comments.map((c) => `- ${c}`).join("\n")}` : "",
            ticket.links.length ? `Links:\n${ticket.links.map((l) => `- ${l}`).join("\n")}` : "",
            start.notes ? `My notes (these win over the ticket):\n${start.notes}` : "",
          ]
            .filter(Boolean)
            .join("\n\n");
        }
        fs.writeFileSync(path.join(runDir, "task.md"), `${task}\n`);
        writeJson(path.join(runDir, "start.json"), start);
        return { ...start, runDir, task } satisfies Setup;
      },
    }),

    // One grilling round per call, in one resumed Claude session.
    grill: action({
      effect: manualEffect("develop.grill"),
      statusDetail: "planner interview",
      timeoutMs: 30 * MINUTE,
      run: async ({ outputs }) => {
        const setup = setupOf(outputs);
        const interview = loadInterview(setup.runDir);
        interview.round += 1;
        const last = interview.round >= MAX_ROUNDS;
        const first = !interview.sessionId;
        interview.sessionId ??= newSessionId();

        const contract = `Return one round as JSON:
- "decided": questions you settled from repo precedent this round, with the precedent (file:line).
- "questions": the open frontier that precedent doesn't settle, each with your recommended answer and the precedent you checked ("none found" or the conflicting places).
- "status": "done" when nothing is left open.
${last ? `This is the last round (${MAX_ROUNDS}): ask nothing new. Put every open question in "questions" with your best recommendation and set status "done".` : ""}`;

        const prompt = first
          ? `/mattpocock-skills:grilling

Interview about this task to reach a complete shared understanding before planning. You run headless: the develop workflow's orchestrator answers each round for me, and I review all answers at the end.

Before asking any question, use the workflow-explorer sub-agent to check how the repo already handles the same thing. If there is a clear precedent, follow it and record it under "decided" instead of asking. Use workflow-planner for design tradeoffs.

${setup.task}

${contract}`
          : `${interview.inbox ?? ""}

Continue the interview: recompute the frontier and return the next round. Keep checking repo precedent before asking.

${contract}`;

        const result = await runClaude<{
          status: "questions" | "done";
          decided: { question: string; answer: string; reason: string; precedent: string }[];
          questions: { question: string; recommendation: string; precedent: string }[];
        }>({
          role: "planner",
          cwd: setup.repository,
          runDir: setup.runDir,
          schema: roundSchema,
          ...(first ? { sessionId: interview.sessionId } : { resume: interview.sessionId }),
          prompt,
        });

        let next = interview.decisions.length;
        const add = (decision: Omit<Decision, "id" | "round" | "reviewed">) =>
          interview.decisions.push({ ...decision, id: String(++next), round: interview.round, reviewed: false });
        for (const d of result.output.decided)
          add({ question: d.question, recommendation: d.answer, precedent: d.precedent, answer: d.answer, reason: d.reason, decidedBy: "precedent" });
        for (const q of result.output.questions)
          add({
            question: q.question,
            recommendation: q.recommendation,
            precedent: q.precedent,
            ...(last ? { answer: q.recommendation, reason: "round limit reached", decidedBy: "round limit" as const } : {}),
          });
        interview.inbox = undefined;
        saveInterview(setup.runDir, interview);

        const open = interview.decisions.filter((d) => !d.answer);
        return { round: interview.round, status: open.length ? "questions" : "done", open: open.length, warnings: result.warnings };
      },
    }),

    answer_round: agent({
      statusDetail: "answering the planner",
      prompt: ({ outputs }) => {
        const open = loadInterview(setupOf(outputs).runDir).decisions.filter((d) => !d.answer);
        return `${ORCHESTRATOR}

The planner asks these questions about the task below. Answer each one yourself. Check repo precedent first (read the code); follow the recommendation unless the task, the code or the decisions so far say otherwise. Don't ask me; I review every answer afterwards.

${taskContext(setupOf(outputs))}

Questions:
${open.map((d) => `[${d.id}] ${d.question}\n    Recommendation: ${d.recommendation}\n    Precedent: ${d.precedent}`).join("\n")}`;
      },
      expectedOutput: `{ "answers": [{ "id": "<question id>", "answer": "...", "reason": "<why, with precedent file:line if any>" }] }`,
    }),

    record_answers: action({
      effect: manualEffect("develop.record-answers"),
      run: ({ outputs }) => {
        const setup = setupOf(outputs);
        const interview = loadInterview(setup.runDir);
        const answers = (outputs.answer_round as { answers: { id: string; answer: string; reason: string }[] }).answers;
        for (const a of answers) {
          const decision = interview.decisions.find((d) => d.id === a.id);
          if (decision && !decision.answer) Object.assign(decision, { answer: a.answer, reason: a.reason, decidedBy: "orchestrator" });
        }
        interview.inbox = `The orchestrator answered:\n${answers.map((a) => `[${a.id}] ${a.answer} (${a.reason})`).join("\n")}`;
        saveInterview(setup.runDir, interview);
        return { answered: answers.length };
      },
    }),

    write_decisions: action({
      effect: manualEffect("develop.write-decisions"),
      run: ({ outputs }) => {
        const setup = setupOf(outputs);
        const file = path.join(setup.runDir, "decisions.md");
        fs.writeFileSync(file, renderDecisions(setup.task, loadInterview(setup.runDir)));
        notify("develop: decisions ready", `Review with /reply-editor ${file}`);
        return { file };
      },
    }),

    decisions_review: checkpoint({
      summary: "review the planner's decisions",
      run: ({ outputs }) => {
        const file = (outputs.write_decisions as { file: string }).file;
        return {
          summary: `Decisions are ready in ${file}. Run \`/reply-editor ${file}\`, annotate what you disagree with as [an: ...] and submit it; the orchestrator passes it on as the answer. Or answer directly: \`ok\` approves everything, \`stop\` cancels the run.`,
          file,
        };
      },
    }),

    record_review: action({
      effect: manualEffect("develop.record-review"),
      run: ({ outputs }) => {
        const setup = setupOf(outputs);
        const raw = outputs.decisions_review;
        const answer = (typeof raw === "string" ? raw : JSON.stringify(raw ?? "")).trim();
        const interview = loadInterview(setup.runDir);
        if (/^"?stop\b/i.test(answer)) return { route: "stop" };
        const annotated = /\[an:/i.test(answer);
        const plainOk = /^"?(ok|yes|approve[d]?|lgtm)?"?$/i.test(answer);
        if (!annotated && (plainOk || /annotated reply below:/i.test(answer))) {
          for (const d of interview.decisions) d.reviewed = true;
          saveInterview(setup.runDir, interview);
          return { route: "plan" };
        }
        // Annotated or free-text changes: my word is final on what I touched.
        for (const d of interview.decisions) d.reviewed = true;
        interview.inbox = `I reviewed the decisions and annotated them. My annotations are final for the questions they touch; update those decisions and only ask about what my changes open up.\n\n${answer}`;
        saveInterview(setup.runDir, interview);
        return { route: "changes" };
      },
    }),

    plan: action({
      effect: manualEffect("develop.plan"),
      statusDetail: "writing the plan",
      timeoutMs: 30 * MINUTE,
      run: async ({ outputs }) => {
        const setup = setupOf(outputs);
        const interview = loadInterview(setup.runDir);
        const review = outputs.plan_review as { verdict: string; findings: { problem: string; requiredChange: string }[] } | undefined;
        const userRetry = (outputs.plan_escalation as { input?: { instructions?: string } } | undefined)?.input?.instructions;
        const feedback =
          review?.verdict === "rejected"
            ? `The plan reviewer rejected the previous plan:\n${review.findings.map((f) => `- ${f.problem} → ${f.requiredChange}`).join("\n")}${userRetry ? `\n\nMy instructions: ${userRetry}` : ""}\n\nRevise the plan.`
            : "The interview is done and I approved the decisions. Write the implementation plan now.";
        const result = await runClaude<Plan>({
          role: "planner",
          cwd: setup.repository,
          runDir: setup.runDir,
          resume: interview.sessionId,
          schema: planSchema,
          prompt: `${feedback}

Use workflow-planner for the design and workflow-explorer to confirm precedent. Each step is one atomic commit: one logical change, its checks passing, reviewable alone. For each step give the goal, the files, acceptance criteria and the checks that prove it. Follow existing patterns; no over-engineering.`,
        });
        const plan = result.output;
        fs.writeFileSync(
          path.join(setup.runDir, "plan.md"),
          [`# Plan`, "", plan.summary, "", ...plan.steps.flatMap((s, i) => [
            `## Step ${i + 1}: ${s.title}`, "", s.goal, "", `Files: ${s.files.join(", ")}`, "",
            "Acceptance:", ...s.acceptance.map((a) => `- ${a}`), "", "Checks:", ...s.checks.map((c) => `- ${c}`), "",
          ]), "## Risks", ...plan.risks.map((r) => `- ${r}`), ""].join("\n"),
        );
        return plan;
      },
    }),

    plan_review: action({
      effect: manualEffect("develop.plan-review"),
      statusDetail: "reviewing the plan",
      timeoutMs: 30 * MINUTE,
      run: async ({ outputs }) => {
        const setup = setupOf(outputs);
        const result = await runClaude({
          role: "planReview",
          cwd: setup.repository,
          runDir: setup.runDir,
          schema: planVerdictSchema,
          prompt: `Review this implementation plan against the task and decisions. Use workflow-explorer to verify that files, patterns and precedent it relies on exist. Reject only for real problems: missing requirements, wrong or missing files, steps that aren't atomic or testable, checks that don't prove the acceptance criteria, or over-engineering. Don't reject for taste.

${taskContext(setup)}

Plan:
${fs.readFileSync(path.join(setup.runDir, "plan.md"), "utf8")}`,
        });
        writeJson(path.join(setup.runDir, `plan-review-${Date.now()}.json`), result.output);
        return result.output;
      },
    }),

    plan_gate: attemptGate("plan_gate", (o) => (o.plan_review as { verdict: string }).verdict !== "approved", "approved", "revise"),
    plan_escalation: escalation("Plan rejected 3 times", (o) =>
      `The plan reviewer rejected the plan ${MAX_ATTEMPTS} times. Latest findings:\n${(o.plan_review as { findings: { problem: string }[] }).findings.map((f) => `- ${f.problem}`).join("\n")}`,
    ),

    next_step: compute({
      run: ({ outputs }) => {
        const previous = (outputs.next_step as { index?: number } | undefined)?.index ?? -1;
        const index = previous + 1;
        return index < planOf(outputs).steps.length ? { route: "implement", index } : { route: "done", index };
      },
    }),

    implement: agent({
      statusDetail: "implementing a plan step",
      timeoutMs: 90 * MINUTE,
      prompt: ({ outputs }) => {
        const setup = setupOf(outputs);
        const plan = planOf(outputs);
        const index = (outputs.next_step as { index: number }).index;
        const step = plan.steps[index];
        const retry = (outputs.step_escalation as { input?: { instructions?: string } } | undefined)?.input?.instructions;
        return implementPrompt(
          setup,
          `Step ${index + 1} of ${plan.steps.length}: ${step.title}
Goal: ${step.goal}
Files: ${step.files.join(", ")}
Acceptance:
${step.acceptance.map((a) => `- ${a}`).join("\n")}
Checks: ${step.checks.join("; ")}
${retry ? `\nPrevious attempt failed. My instructions: ${retry}\n` : ""}
Context:
${taskContext(setup, plan)}`,
        );
      },
      expectedOutput: IMPLEMENTER_RESULT,
    }),

    implement_gate: compute({
      run: ({ outputs }) => ({ route: (outputs.implement as { status: string }).status === "done" ? "next" : "escalate" }),
    }),
    step_escalation: escalation("Implementer couldn't finish a step", (o) => {
      const r = o.implement as { status: string; summary: string; notes: string };
      return `Step ${(o.next_step as { index: number }).index + 1} ended with status "${r.status}": ${r.summary} ${r.notes}`;
    }),

    verify: shell({
      effect: manualEffect("develop.verify"),
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
        passed: result.exitCode === 0,
        tail: `${result.stdout}\n${result.stderr}`.trim().split("\n").slice(-120).join("\n"),
      }),
    }),

    verify_gate: attemptGate("verify_gate", (o) => !(o.verify as { passed: boolean }).passed, "passed", "fix"),
    fix_verify: agent({
      statusDetail: "fixing verify failures",
      timeoutMs: 90 * MINUTE,
      prompt: ({ outputs }) =>
        implementPrompt(
          setupOf(outputs),
          `Fix-up step: the verify suite failed. Fix the failures this branch caused (use fixer first for mechanical lint/type/format errors) and commit the fix as one commit. If a failure is unrelated to this branch, don't touch it; say so in notes.

Verify output (last lines):
${(outputs.verify as { tail: string }).tail}

Context:
${taskContext(setupOf(outputs), planOf(outputs))}`,
        ),
      expectedOutput: IMPLEMENTER_RESULT,
    }),

    final_review: action({
      effect: manualEffect("develop.final-review"),
      statusDetail: "final review",
      timeoutMs: 60 * MINUTE,
      run: async ({ outputs }) => {
        const setup = setupOf(outputs);
        const repoReview = hasSkill(setup.repository, "review-changes");
        const result = await runClaude<{ summary: string; findings: Finding[] }>({
          role: "finalReview",
          cwd: setup.repository,
          runDir: setup.runDir,
          schema: reviewSchema,
          prompt: `Final review of this branch against ${setup.base}.

1. Use the Skill tool to run mattpocock-skills:code-review with fixed point ${setup.base}. The spec is the task below; don't look for another spec and don't ask for one.
${repoReview ? `2. Use the Skill tool to run the repo's review-changes skill with base ${setup.base}.` : ""}

Return every finding. source is "spec" or "standards" for code-review findings and "review-changes" for the repo skill. severity: for review-changes use blocker/suggestion/nit; for standards say whether it's a documented-rule breach or a smell. documentedRule is true only when the finding cites a rule written in the repo's docs.

Task (the spec):
${setup.task}`,
        });
        writeJson(path.join(setup.runDir, `final-review-${Date.now()}.json`), result.output);
        return result.output;
      },
    }),

    check_findings: action({
      effect: manualEffect("develop.check-findings"),
      statusDetail: "checking review findings",
      timeoutMs: 30 * MINUTE,
      run: async ({ outputs }) => {
        const setup = setupOf(outputs);
        const review = outputs.final_review as { findings: Finding[] };
        if (review.findings.length === 0) return { blocking: [], noted: [], skipped: [] };
        const result = await runClaude<{ items: { id: string; decision: "fix" | "skip"; reason: string }[] }>({
          role: "checker",
          cwd: setup.repository,
          runDir: setup.runDir,
          schema: checkSchema,
          prompt: `Be skeptical. For each review finding below decide "fix" or "skip". Keep a finding only if it is:
- real: a concrete failing input or code path in this branch, not "could theoretically";
- in scope: about this branch's change (git diff ${setup.base}...HEAD);
- worth it: the fix is proportionate, with no new abstractions, options or flexibility just in case.
Verify each claim in the code (use workflow-explorer). Give a one-line reason.

${JSON.stringify(review.findings, null, 2)}`,
        });
        const fix = new Set(result.output.items.filter((i) => i.decision === "fix").map((i) => i.id));
        const blocks = (f: Finding) =>
          f.source === "spec" || (f.source === "standards" && f.documentedRule) || (f.source === "review-changes" && /blocker/i.test(f.severity));
        const checked = { items: result.output.items, findings: review.findings };
        writeJson(path.join(setup.runDir, `checked-findings-${Date.now()}.json`), checked);
        return {
          blocking: review.findings.filter((f) => fix.has(f.id) && blocks(f)),
          noted: review.findings.filter((f) => fix.has(f.id) && !blocks(f)),
          skipped: result.output.items.filter((i) => i.decision === "skip"),
        };
      },
    }),

    review_gate: attemptGate("review_gate", (o) => (o.check_findings as { blocking: unknown[] }).blocking.length > 0, "approved", "fix"),
    fix_review: agent({
      statusDetail: "fixing review findings",
      timeoutMs: 90 * MINUTE,
      prompt: ({ outputs }) => {
        const blocking = (outputs.check_findings as { blocking: Finding[] }).blocking;
        return implementPrompt(
          setupOf(outputs),
          `Fix-up step: address these confirmed review findings with one commit, minimally:
${blocking.map((f) => `- ${f.file}${f.line ? `:${f.line}` : ""}: ${f.problem} → ${f.requiredChange}`).join("\n")}

Context:
${taskContext(setupOf(outputs), planOf(outputs))}`,
        );
      },
      expectedOutput: IMPLEMENTER_RESULT,
    }),
    fix_escalation: escalation("Fixes didn't converge", (o) => {
      const verify = o.verify as { passed: boolean; tail: string } | undefined;
      const blocking = (o.check_findings as { blocking: Finding[] } | undefined)?.blocking ?? [];
      return verify && !verify.passed
        ? `Verify still fails after ${MAX_ATTEMPTS} fix attempts:\n${verify.tail.split("\n").slice(-15).join("\n")}`
        : `Review findings still open after ${MAX_ATTEMPTS} attempts:\n${blocking.map((f) => `- ${f.problem}`).join("\n")}`;
    }),

    approve_push: humanDecision({
      audience: "operator",
      choices: pushChoices,
      request: ({ outputs }) => {
        const setup = setupOf(outputs);
        const commits = git(setup.repository, "log", "--oneline", `${setup.base}..HEAD`).split("\n").filter(Boolean);
        const checked = outputs.check_findings as { noted: Finding[]; skipped: { id: string; reason: string }[] };
        const decided = loadInterview(setup.runDir).decisions.filter((d) => d.decidedBy !== "you");
        notify("develop: ready to push", `${commits.length} commit(s) on ${setup.branch}`);
        return {
          title: `Push ${setup.branch} and open a draft PR?`,
          subject: { commits, runDir: setup.runDir },
          presentation: {
            schema: "pi-workflows.decision-presentation.v1",
            summary: `${commits.length} commit(s), verify passed, final review approved.`,
            blocks: [
              { kind: "section", title: "Commits" },
              { kind: "bullets", items: commits },
              { kind: "section", title: "Noted, not blocking" },
              { kind: "bullets", items: checked.noted.length ? checked.noted.map((f) => `${f.file}: ${f.problem}`) : ["none"] },
              { kind: "section", title: "Decided without you" },
              { kind: "bullets", items: decided.length ? decided.map((d) => `${d.question} → ${d.answer}`) : ["none"] },
              { kind: "paragraph", text: `Run files: ${setup.runDir}` },
            ],
          },
        };
      },
    }),

    fix_user: agent({
      statusDetail: "applying your fixes",
      timeoutMs: 90 * MINUTE,
      prompt: ({ outputs }) => {
        const instructions =
          (outputs.approve_push as { input?: { instructions?: string } } | undefined)?.input?.instructions ??
          (outputs.fix_escalation as { input?: { instructions?: string } } | undefined)?.input?.instructions ??
          "";
        return implementPrompt(
          setupOf(outputs),
          `Fix-up step from me. Do exactly this, as one commit:
${instructions}

Context:
${taskContext(setupOf(outputs), planOf(outputs))}`,
        );
      },
      expectedOutput: IMPLEMENTER_RESULT,
    }),

    push: shell({
      effect: manualEffect("develop.push"),
      statusDetail: "pushing",
      exec: ({ outputs }) => ({
        command: "git",
        args: ["push", "-u", "origin", "HEAD"],
        cwd: setupOf(outputs).repository,
        timeoutMs: 5 * MINUTE,
      }),
    }),

    create_pr: action({
      effect: manualEffect("develop.create-pr"),
      statusDetail: "opening a draft PR",
      timeoutMs: 20 * MINUTE,
      run: async ({ outputs }) => {
        const setup = setupOf(outputs);
        const skill = hasSkill(setup.repository, "pull-request-creation") ? "the repo's pull-request-creation skill" : "the mattpocock-skills:pr skill to write the body, then gh pr create";
        const result = await runClaude<{ url: string }>({
          role: "prWriter",
          cwd: setup.repository,
          runDir: setup.runDir,
          schema: prSchema,
          prompt: `The branch ${setup.branch} is pushed. Use the Skill tool to run ${skill} and open the PR as a **draft** (gh pr create --draft). Base it on the diff against ${setup.base}.${setup.linearId ? ` It implements Linear issue ${setup.linearId}.` : ""} Return the PR URL.`,
        });
        return result.output;
      },
    }),

    open_review: shell({
      effect: manualEffect("develop.open-review"),
      exec: ({ outputs }) => {
        const setup = setupOf(outputs);
        return {
          command: "bash",
          args: [path.join(os.homedir(), ".config/herdr/local-plugins/pr-review/open.sh"), setup.repository, (outputs.create_pr as { url: string }).url, setup.piPane],
          cwd: setup.repository,
          timeoutMs: 2 * MINUTE,
          allowNonZeroExit: true,
        };
      },
    }),

    done: notifyNode({
      kind: "final",
      message: ({ outputs }) => {
        notify("develop: done", (outputs.create_pr as { url: string }).url, "done");
        return `Draft PR opened: ${(outputs.create_pr as { url: string }).url}. The PR review tab watches CI and comments.`;
      },
    }),

    stopped: notifyNode({
      kind: "final",
      message: ({ outputs }) => `Stopped. Run files: ${setupOf(outputs)?.runDir ?? "none"}`,
    }),
  },
  edges: [
    { from: "start", to: "setup" },
    { from: "setup", to: "grill" },
    { from: "grill", switch: { on: "$.status", cases: { questions: "answer_round", done: "write_decisions" } } },
    { from: "answer_round", to: "record_answers" },
    { from: "record_answers", to: "grill" },
    { from: "write_decisions", to: "decisions_review" },
    { from: "decisions_review", to: "record_review" },
    { from: "record_review", switch: { on: "$.route", cases: { plan: "plan", changes: "grill", stop: "stopped" } } },
    { from: "plan", to: "plan_review" },
    { from: "plan_review", to: "plan_gate" },
    { from: "plan_gate", switch: { on: "$.route", cases: { approved: "next_step", revise: "plan", escalate: "plan_escalation" } } },
    humanDecisionEdge({ from: "plan_escalation", choices: retryChoices, cases: { retry: "plan", stop: "stopped" } }),
    { from: "next_step", switch: { on: "$.route", cases: { implement: "implement", done: "verify" } } },
    { from: "implement", to: "implement_gate" },
    { from: "implement_gate", switch: { on: "$.route", cases: { next: "next_step", escalate: "step_escalation" } } },
    humanDecisionEdge({ from: "step_escalation", choices: retryChoices, cases: { retry: "implement", stop: "stopped" } }),
    { from: "verify", to: "verify_gate" },
    { from: "verify_gate", switch: { on: "$.route", cases: { passed: "final_review", fix: "fix_verify", escalate: "fix_escalation" } } },
    { from: "fix_verify", to: "verify" },
    { from: "final_review", to: "check_findings" },
    { from: "check_findings", to: "review_gate" },
    { from: "review_gate", switch: { on: "$.route", cases: { approved: "approve_push", fix: "fix_review", escalate: "fix_escalation" } } },
    { from: "fix_review", to: "verify" },
    humanDecisionEdge({ from: "fix_escalation", choices: retryChoices, cases: { retry: "fix_user", stop: "stopped" } }),
    humanDecisionEdge({ from: "approve_push", choices: pushChoices, cases: { push: "push", fix: "fix_user", stop: "stopped" } }),
    { from: "fix_user", to: "verify" },
    { from: "push", to: "create_pr" },
    { from: "create_pr", to: "open_review" },
    { from: "open_review", to: "done" },
  ],
});
