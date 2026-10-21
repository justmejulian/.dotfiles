// Planning only: existing intake, interview, decisions, plan review and escalation.
import fs from "node:fs";
import path from "node:path";
import {
  action,
  agent,
  checkpoint,
  compute,
  defineWorkflow,
  humanDecisionEdge,
  manualEffect,
} from "@osolmaz/pi-workflows";
import { newSessionId, runClaude } from "./lib/claude.ts";
import { fetchSlack, formatSlack, slackLinks } from "./lib/slack.ts";
import {
  currentDecisions,
  type Decision,
  loadInterview,
  notify,
  parseReviewAnswer,
  renderDecisions,
  runDirFor,
  saveInterview,
  writeJson,
} from "./lib/develop.ts";
import {
  attemptGate,
  escalation,
  MAX_ATTEMPTS,
  MINUTE,
  ORCHESTRATOR,
  obj,
  retryChoices,
  type Setup as BaseSetup,
  str,
  strs,
  trackPi,
} from "./lib/nodes.ts";
import { object, parseBlocked, parsePlan, type Plan } from "./lib/stages.ts";
export type Planned = { setup: Setup; plan: Plan };
function parsePlanned(value: unknown): Planned {
  const v = object(value),
    setup = object(v.setup) as Setup;
  if (
    !setup.repository ||
    !setup.base ||
    !setup.branch ||
    !setup.runDir ||
    !setup.task
  )
    throw new Error("missing planning context");
  return { setup, plan: parsePlan(v.plan) };
}

const MAX_ROUNDS = 5;

type Start = {
  repository: string;
  base: string;
  branch: string;
  linearId: string | null;
  notes: string;
  piPane: string;
};
type Setup = BaseSetup & Start;

const setupOf = (outputs: Record<string, unknown>) => outputs.setup as Setup;
const planOf = (outputs: Record<string, unknown>) => outputs.plan as Plan;

// --- JSON schemas for Claude's answers -------------------------------------

const intakeSchema = obj({
  title: str,
  description: str,
  comments: strs,
  links: strs,
});
const roundSchema = obj({
  status: { type: "string", enum: ["questions", "done"] },
  decided: {
    type: "array",
    items: obj({
      question: str,
      answer: str,
      reason: str,
      precedent: str,
      basis: { type: "string", enum: ["precedent", "your annotation"] },
      replaces: str,
    }),
  },
  questions: {
    type: "array",
    items: obj({
      question: str,
      recommendation: str,
      precedent: str,
      replaces: str,
    }),
  },
});
const planSchema = obj({
  summary: str,
  steps: {
    type: "array",
    items: obj({
      title: str,
      goal: str,
      files: strs,
      acceptance: strs,
      checks: strs,
    }),
  },
  risks: strs,
});
const planVerdictSchema = obj({
  verdict: { type: "string", enum: ["approved", "rejected"] },
  findings: {
    type: "array",
    items: obj({ severity: str, problem: str, requiredChange: str }),
  },
});
const prSchema = obj({ url: str });

function taskContext(setup: Setup, plan?: Plan) {
  const parts = [`Task:\n${setup.task}`];
  if (plan) parts.push(`Plan summary: ${plan.summary}`);
  const decisions = currentDecisions(loadInterview(setup.runDir));
  if (decisions.length)
    parts.push(
      `Decisions:\n${decisions.map((d) => `- ${d.question} → ${d.answer}`).join("\n")}`,
    );
  return parts.join("\n\n");
}

// --- Workflow ----------------------------------------------------------------

export default defineWorkflow({
  name: "plan",
  source: import.meta.url,
  input: (value): { task: string } => ({
    task: String((value as { task?: string } | null)?.task ?? ""),
  }),
  exits: {
    ready: { from: "ready", validate: parsePlanned },
    blocked: { from: "blocked", validate: parseBlocked },
  },
  title: ({ input }) =>
    `plan: ${String((input as { task?: string }).task ?? "").slice(0, 60)}`,
  startAt: "start",
  maxSteps: 120,
  nodes: {
    // pi knows where it runs; the workflow server doesn't.
    start: agent({
      timeoutMs: 15 * MINUTE,
      statusDetail: "reading the repo and task",
      prompt: ({ input }) => `${ORCHESTRATOR}

Prepare the plan workflow for this request: ${JSON.stringify((input as { task?: string }).task ?? "")}

Run \`git rev-parse --show-toplevel\`, \`git branch --show-current\`, \`git merge-base HEAD origin/main\` (fall back to the repo's default branch) and \`echo $HERDR_PANE_ID\`. Split the request into a Linear issue ID (like VIZ-123, if present) and my notes (the rest). If the request is empty, leave both empty; don't invent a task.`,
      expectedOutput: `{ "repository": "<absolute repo root>", "branch": "...", "base": "<merge-base sha>", "linearId": "<ID or null>", "notes": "...", "piPane": "<HERDR_PANE_ID>" }`,
      validate: (output) => {
        const start = output as Start;
        if (
          !path.isAbsolute(start.repository) ||
          !fs.existsSync(path.join(start.repository, ".git"))
        )
          throw new Error("repository must be the absolute git root");
        if (start.branch === "main" || start.branch === "master")
          throw new Error("refusing to work on the default branch");
        return {
          ...start,
          route: start.linearId || start.notes.trim() ? "task" : "empty",
        };
      },
    }),

    setup: action({
      effect: manualEffect("develop.setup"),
      statusDetail: "fetching the Linear issue and Slack threads",
      timeoutMs: 10 * MINUTE,
      run: async ({ outputs, state, signal }) => {
        const start = outputs.start as Start;
        const runDir = runDirFor(start.repository, state.runId);
        let task = start.notes;
        if (start.linearId) {
          const issue = await runClaude<{
            title: string;
            description: string;
            comments: string[];
            links: string[];
          }>({
            role: "intake",
            signal,
            cwd: start.repository,
            runDir,
            schema: intakeSchema,
            prompt: `Fetch Linear issue ${start.linearId} with the Linear tools: title, description, comments (oldest first, each prefixed with the author) and links (PRs, docs, designs). Return them verbatim, without summarising.`,
          });
          const ticket = issue.output;
          task = [
            `${start.linearId}: ${ticket.title}`,
            ticket.description,
            ticket.comments.length
              ? `Comments:\n${ticket.comments.map((c) => `- ${c}`).join("\n")}`
              : "",
            ticket.links.length
              ? `Links:\n${ticket.links.map((l) => `- ${l}`).join("\n")}`
              : "",
            start.notes
              ? `My notes (these win over the ticket):\n${start.notes}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n");
        }
        // Slack threads linked from my notes or the ticket are part of the task.
        const links = slackLinks(task).slice(0, 5);
        const threads = await Promise.all(
          links.map((link) =>
            fetchSlack(link, { runDir, cwd: start.repository, signal }).then(
              formatSlack,
              (e) => `Slack link ${link}: couldn't fetch (${e})`,
            ),
          ),
        );
        signal.throwIfAborted();
        if (threads.length)
          task = `${task}\n\nLinked Slack threads:\n\n${threads.join("\n\n")}`;
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
      run: async ({ outputs, signal }) => {
        trackPi(outputs);
        const setup = setupOf(outputs);
        const interview = loadInterview(setup.runDir);
        interview.round += 1;
        const last = interview.round >= MAX_ROUNDS;
        const first = !interview.sessionId;
        interview.sessionId ??= newSessionId();

        const contract = `Return one round as JSON:
- "decided": questions you settled this round, with the precedent (file:line). basis is "your annotation" when my annotation decided it, else "precedent".
- "questions": the open frontier that precedent doesn't settle, each with your recommended answer and the precedent you checked ("none found" or the conflicting places).
- "replaces": the id of an earlier decision this one replaces (e.g. after my annotation), or "".
- "status": "done" when nothing is left open.
${last ? `This is the last round (${MAX_ROUNDS}): ask nothing new. Put every open question in "questions" with your best recommendation and set status "done".` : ""}`;

        const prompt = first
          ? `/mattpocock-skills:grilling

Interview about this task to reach a complete shared understanding before planning. You run headless: the plan workflow's orchestrator answers each round for me, and I review all answers at the end.

Before asking any question, use the workflow-explorer sub-agent to check how the repo already handles the same thing. If there is a clear precedent, follow it and record it under "decided" instead of asking. Use workflow-planner for design tradeoffs.

${setup.task}

${contract}`
          : `${interview.inbox ?? ""}

Continue the interview: recompute the frontier and return the next round. Keep checking repo precedent before asking.

${contract}`;

        const result = await runClaude<{
          status: "questions" | "done";
          decided: {
            question: string;
            answer: string;
            reason: string;
            precedent: string;
            basis: string;
            replaces: string;
          }[];
          questions: {
            question: string;
            recommendation: string;
            precedent: string;
            replaces: string;
          }[];
        }>({
          role: "planner",
          signal,
          cwd: setup.repository,
          runDir: setup.runDir,
          schema: roundSchema,
          ...(first
            ? { sessionId: interview.sessionId }
            : { resume: interview.sessionId }),
          prompt,
        });

        let next = interview.decisions.length;
        const add = (
          decision: Omit<Decision, "id" | "round" | "reviewed">,
          replaces: string,
        ) => {
          const id = String(++next);
          const old = interview.decisions.find(
            (d) => d.id === replaces.replace(/\D/g, ""),
          );
          if (old) old.supersededBy = id;
          interview.decisions.push({
            ...decision,
            id,
            round: interview.round,
            reviewed: false,
          });
        };
        for (const d of result.output.decided)
          add(
            {
              question: d.question,
              recommendation: d.answer,
              precedent: d.precedent,
              answer: d.answer,
              reason: d.reason,
              decidedBy: d.basis === "your annotation" ? "you" : "precedent",
            },
            d.replaces,
          );
        for (const q of result.output.questions)
          add(
            {
              question: q.question,
              recommendation: q.recommendation,
              precedent: q.precedent,
              ...(last
                ? {
                    answer: q.recommendation,
                    reason: "round limit reached",
                    decidedBy: "round limit" as const,
                  }
                : {}),
            },
            q.replaces,
          );
        interview.inbox = undefined;
        saveInterview(setup.runDir, interview);

        const open = interview.decisions.filter((d) => !d.answer);
        return {
          round: interview.round,
          status: open.length ? "questions" : "done",
          open: open.length,
          warnings: result.warnings,
        };
      },
    }),

    answer_round: agent({
      timeoutMs: 15 * MINUTE,
      statusDetail: "answering the planner",
      prompt: ({ outputs }) => {
        const open = loadInterview(setupOf(outputs).runDir).decisions.filter(
          (d) => !d.answer,
        );
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
      timeoutMs: MINUTE,
      run: ({ outputs }) => {
        trackPi(outputs);
        const setup = setupOf(outputs);
        const interview = loadInterview(setup.runDir);
        const answers = (
          outputs.answer_round as {
            answers: { id: string; answer: string; reason: string }[];
          }
        ).answers;
        for (const a of answers) {
          const decision = interview.decisions.find((d) => d.id === a.id);
          if (decision && !decision.answer)
            Object.assign(decision, {
              answer: a.answer,
              reason: a.reason,
              decidedBy: "orchestrator",
            });
        }
        interview.inbox = `The orchestrator answered:\n${answers.map((a) => `[${a.id}] ${a.answer} (${a.reason})`).join("\n")}`;
        saveInterview(setup.runDir, interview);
        return { answered: answers.length };
      },
    }),

    write_decisions: action({
      effect: manualEffect("develop.write-decisions"),
      timeoutMs: MINUTE,
      run: ({ outputs }) => {
        const setup = setupOf(outputs);
        const interview = loadInterview(setup.runDir);
        if (!interview.decisions.some((d) => !d.reviewed && !d.supersededBy))
          return { route: "plan" };
        const file = path.join(setup.runDir, "decisions.md");
        fs.writeFileSync(file, renderDecisions(setup.task, interview));
        notify("plan: decisions ready", `Review with /reply-editor ${file}`);
        return { route: "review", file };
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
      timeoutMs: MINUTE,
      run: ({ outputs }) => {
        trackPi(outputs);
        const setup = setupOf(outputs);
        const { route, text } = parseReviewAnswer(outputs.decisions_review);
        if (route === "stop") return { route };
        const interview = loadInterview(setup.runDir);
        for (const d of interview.decisions) d.reviewed = true;
        if (route === "changes") {
          // My word is final on what I touched.
          interview.inbox = `I reviewed the decisions and annotated them. My annotations are final for the questions they touch: record each as a decided question with basis "your annotation" and "replaces" set to the original id, and only ask about what my changes open up.\n\n${text}`;
        }
        saveInterview(setup.runDir, interview);
        return { route };
      },
    }),

    plan: action({
      effect: manualEffect("develop.plan"),
      statusDetail: "writing the plan",
      timeoutMs: 30 * MINUTE,
      run: async ({ outputs, signal }) => {
        trackPi(outputs);
        const setup = setupOf(outputs);
        const interview = loadInterview(setup.runDir);
        const review = outputs.plan_review as
          | {
              verdict: string;
              findings: { problem: string; requiredChange: string }[];
            }
          | undefined;
        const userRetry = (
          outputs.plan_escalation as
            { input?: { instructions?: string } } | undefined
        )?.input?.instructions;
        const feedback =
          review?.verdict === "rejected"
            ? `The plan reviewer rejected the previous plan:\n${review.findings.map((f) => `- ${f.problem} → ${f.requiredChange}`).join("\n")}${userRetry ? `\n\nMy instructions: ${userRetry}` : ""}\n\nRevise the plan.`
            : "The interview is done and I approved the decisions. Write the implementation plan now.";
        const result = await runClaude<Plan>({
          role: "planner",
          signal,
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
          [
            `# Plan`,
            "",
            plan.summary,
            "",
            ...plan.steps.flatMap((s, i) => [
              `## Step ${i + 1}: ${s.title}`,
              "",
              s.goal,
              "",
              `Files: ${s.files.join(", ")}`,
              "",
              "Acceptance:",
              ...s.acceptance.map((a) => `- ${a}`),
              "",
              "Checks:",
              ...s.checks.map((c) => `- ${c}`),
              "",
            ]),
            "## Risks",
            ...plan.risks.map((r) => `- ${r}`),
            "",
          ].join("\n"),
        );
        return plan;
      },
    }),

    plan_review: action({
      effect: manualEffect("develop.plan-review"),
      statusDetail: "reviewing the plan",
      timeoutMs: 30 * MINUTE,
      run: async ({ outputs, signal }) => {
        trackPi(outputs);
        const setup = setupOf(outputs);
        const result = await runClaude({
          role: "planReview",
          signal,
          cwd: setup.repository,
          runDir: setup.runDir,
          schema: planVerdictSchema,
          prompt: `Review this implementation plan against the task and decisions. Use workflow-explorer to verify that files, patterns and precedent it relies on exist. Reject only for real problems: missing requirements, wrong or missing files, steps that aren't atomic or testable, checks that don't prove the acceptance criteria, or over-engineering. Don't reject for taste.

${taskContext(setup)}

Plan:
${fs.readFileSync(path.join(setup.runDir, "plan.md"), "utf8")}`,
        });
        writeJson(
          path.join(setup.runDir, `plan-review-${Date.now()}.json`),
          result.output,
        );
        return result.output;
      },
    }),

    plan_gate: attemptGate(
      "plan_gate",
      (o) => (o.plan_review as { verdict: string }).verdict !== "approved",
      "approved",
      "revise",
    ),
    plan_escalation: escalation(
      "plan",
      "Plan rejected 3 times",
      (o) =>
        `The plan reviewer rejected the plan ${MAX_ATTEMPTS} times. Latest findings:\n${(o.plan_review as { findings: { problem: string }[] }).findings.map((f) => `- ${f.problem}`).join("\n")}`,
    ),

    ready: compute({
      run: ({ outputs }) => ({ setup: outputs.setup, plan: outputs.plan }),
    }),
    blocked: compute({
      run: ({ outputs }) => ({
        reason: "Planning stopped or no task supplied",
        evidence: outputs.plan_review,
      }),
    }),
  },
  edges: [
    {
      from: "start",
      switch: { on: "$.route", cases: { task: "setup", empty: "blocked" } },
    },
    { from: "setup", to: "grill" },
    {
      from: "grill",
      switch: {
        on: "$.status",
        cases: { questions: "answer_round", done: "write_decisions" },
      },
    },
    { from: "answer_round", to: "record_answers" },
    { from: "record_answers", to: "grill" },
    {
      from: "write_decisions",
      switch: {
        on: "$.route",
        cases: { review: "decisions_review", plan: "plan" },
      },
    },
    { from: "decisions_review", to: "record_review" },
    {
      from: "record_review",
      switch: {
        on: "$.route",
        cases: { plan: "plan", changes: "grill", stop: "blocked" },
      },
    },
    { from: "plan", to: "plan_review" },
    { from: "plan_review", to: "plan_gate" },
    {
      from: "plan_gate",
      switch: {
        on: "$.route",
        cases: {
          approved: "ready",
          revise: "plan",
          escalate: "plan_escalation",
        },
      },
    },
    humanDecisionEdge({
      from: "plan_escalation",
      choices: retryChoices,
      cases: { retry: "plan", stop: "blocked" },
    }),
  ],
});
