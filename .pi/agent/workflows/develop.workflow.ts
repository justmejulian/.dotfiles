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
  compute,
  defineWorkflow,
  humanDecision,
  humanDecisionEdge,
  manualEffect,
  notify as notifyNode,
  shell,
} from "@osolmaz/pi-workflows";
import { newSessionId, runClaude } from "./lib/claude.ts";
import {
  type Decision,
  hasSkill,
  loadInterview,
  notify,
  renderDecisions,
  runDirFor,
  saveInterview,
  writeJson,
} from "./lib/develop.ts";
import {
  attemptGate,
  checkFindingsNode,
  commitsSince,
  escalation,
  type Finding,
  finalReviewNode,
  fixEscalation,
  fixReviewNode,
  fixUserNode,
  fixVerifyNode,
  implementGate,
  implementNode,
  MAX_ATTEMPTS,
  MINUTE,
  ORCHESTRATOR,
  obj,
  pushChoices,
  retryChoices,
  type Setup as BaseSetup,
  str,
  strs,
  trackPi,
  verifyNode,
  wrapNode,
} from "./lib/nodes.ts";

const MAX_ROUNDS = 5;

type Start = { repository: string; base: string; branch: string; linearId: string | null; notes: string; piPane: string };
type Setup = BaseSetup & Start;
type Step = { title: string; goal: string; files: string[]; acceptance: string[]; checks: string[] };
type Plan = { summary: string; steps: Step[]; risks: string[] };

const setupOf = (outputs: Record<string, unknown>) => outputs.setup as Setup;
const planOf = (outputs: Record<string, unknown>) => outputs.plan as Plan;

// --- JSON schemas for Claude's answers -------------------------------------

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
const prSchema = obj({ url: str });

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
        trackPi(outputs);
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
        trackPi(outputs);
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
        trackPi(outputs);
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
        trackPi(outputs);
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
        trackPi(outputs);
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
    plan_escalation: escalation("develop", "Plan rejected 3 times", (o) =>
      `The plan reviewer rejected the plan ${MAX_ATTEMPTS} times. Latest findings:\n${(o.plan_review as { findings: { problem: string }[] }).findings.map((f) => `- ${f.problem}`).join("\n")}`,
    ),

    next_step: compute({
      run: ({ outputs }) => {
        const previous = (outputs.next_step as { index?: number } | undefined)?.index ?? -1;
        const index = previous + 1;
        return index < planOf(outputs).steps.length ? { route: "implement", index } : { route: "done", index };
      },
    }),

    implement: implementNode("implementing a plan step", (outputs) => {
        const setup = setupOf(outputs);
        const plan = planOf(outputs);
        const index = (outputs.next_step as { index: number }).index;
        const step = plan.steps[index];
        const retry = (outputs.step_escalation as { input?: { instructions?: string } } | undefined)?.input?.instructions;
        return `Step ${index + 1} of ${plan.steps.length}: ${step.title}
Goal: ${step.goal}
Files: ${step.files.join(", ")}
Acceptance:
${step.acceptance.map((a) => `- ${a}`).join("\n")}
Checks: ${step.checks.join("; ")}
${retry ? `\nPrevious attempt failed. My instructions: ${retry}\n` : ""}
Context:
${taskContext(setup, plan)}`;
      }),

    implement_gate: implementGate("develop.implement-gate", "implement"),

    step_escalation: escalation("develop", "Implementer couldn't finish a step", (o) => {
      const r = o.implement as { status: string; summary: string; notes: string };
      return `Step ${(o.next_step as { index: number }).index + 1} ended with status "${r.status}": ${r.summary} ${r.notes}`;
    }),

    verify: verifyNode("develop.verify"),

    verify_gate: attemptGate("verify_gate", (o) => !(o.verify as { passed: boolean }).passed, "passed", "fix"),
    fix_verify: fixVerifyNode((o) => taskContext(setupOf(o), planOf(o))),

    final_review: finalReviewNode("develop.final-review"),

    check_findings: checkFindingsNode("develop.check-findings"),

    review_gate: attemptGate("review_gate", (o) => (o.check_findings as { blocking: unknown[] }).blocking.length > 0, "approved", "fix"),
    fix_review: fixReviewNode((o) => taskContext(setupOf(o), planOf(o))),

    fix_escalation: fixEscalation("develop"),

    approve_push: humanDecision({
      audience: "operator",
      choices: pushChoices,
      request: ({ outputs }) => {
        const setup = setupOf(outputs);
        const commits = commitsSince(setup);
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

    fix_user: fixUserNode((o) => taskContext(setupOf(o), planOf(o)), ["approve_push", "fix_escalation"]),

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
        trackPi(outputs);
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

    wrap_done: wrapNode("develop.wrap-done"),

    wrap_stop: wrapNode("develop.wrap-stop"),

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
    { from: "record_review", switch: { on: "$.route", cases: { plan: "plan", changes: "grill", stop: "wrap_stop" } } },
    { from: "plan", to: "plan_review" },
    { from: "plan_review", to: "plan_gate" },
    { from: "plan_gate", switch: { on: "$.route", cases: { approved: "next_step", revise: "plan", escalate: "plan_escalation" } } },
    humanDecisionEdge({ from: "plan_escalation", choices: retryChoices, cases: { retry: "plan", stop: "wrap_stop" } }),
    { from: "next_step", switch: { on: "$.route", cases: { implement: "implement", done: "final_review" } } },
    { from: "implement", to: "implement_gate" },
    { from: "implement_gate", switch: { on: "$.route", cases: { verify: "verify", escalate: "step_escalation" } } },
    humanDecisionEdge({ from: "step_escalation", choices: retryChoices, cases: { retry: "implement", stop: "wrap_stop" } }),
    { from: "verify", to: "verify_gate" },
    { from: "verify_gate", switch: { on: "$.route", cases: { passed: "next_step", fix: "fix_verify", escalate: "fix_escalation" } } },
    { from: "fix_verify", to: "verify" },
    { from: "final_review", to: "check_findings" },
    { from: "check_findings", to: "review_gate" },
    { from: "review_gate", switch: { on: "$.route", cases: { approved: "approve_push", fix: "fix_review", escalate: "fix_escalation" } } },
    { from: "fix_review", to: "verify" },
    humanDecisionEdge({ from: "fix_escalation", choices: retryChoices, cases: { retry: "fix_user", stop: "wrap_stop" } }),
    humanDecisionEdge({ from: "approve_push", choices: pushChoices, cases: { push: "push", fix: "fix_user", stop: "wrap_stop" } }),
    { from: "fix_user", to: "verify" },
    { from: "push", to: "create_pr" },
    { from: "create_pr", to: "open_review" },
    { from: "open_review", to: "wrap_done" },
    { from: "wrap_done", to: "done" },
    { from: "wrap_stop", to: "stopped" },
  ],
});
