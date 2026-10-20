// /workflow address-feedback [--input-json {"file": "<items.json>"}]
//
// Started by the PR review tab's watchers (~/.config/herdr/local-plugins/
// pr-review) with batched CI failures and review comments. Run by hand
// without input, it collects the current branch PR's open feedback itself. CI failures are
// fixed directly; comments are checked first (real, in scope, proportionate).
// Every fix is an atomic commit that passes the full suite, then a final
// review, my approval, push, PR description update and replies on GitHub.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  action,
  agent,
  defineWorkflow,
  humanDecision,
  humanDecisionEdge,
  manualEffect,
  notify as notifyNode,
  shell,
} from "@osolmaz/pi-workflows";
import { runClaude } from "./lib/claude.ts";
import { git, notify, runDirFor, writeJson } from "./lib/develop.ts";
import {
  attemptGate,
  CHECK_RULES,
  checkFindingsNode,
  checkSchema,
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
  MINUTE,
  ORCHESTRATOR,
  pushChoices,
  retryChoices,
  type Setup as BaseSetup,
  trackPi,
  verifyNode,
  wrapNode,
} from "./lib/nodes.ts";

/** One piece of feedback, as the watchers write it. */
type Item = {
  key: string;
  kind: "ci" | "thread" | "comment" | "review";
  author?: string;
  authorIsBot?: boolean;
  where: string;
  url: string;
  body: string;
  /** Review thread node id (resolve) and a comment's database id (reply). */
  threadId?: string;
  commentId?: number;
};
type Batch = { repo: string; pr: number; url: string; items: Item[] };
type Setup = BaseSetup & Batch & { marker: string };
/** A unit of work: all CI failures together, or one comment. */
type Work = { kind: "ci" | "comment"; items: Item[] };

const activeDir = path.join(process.env.HOME ?? "", ".cache/pr-review/active");
const collectScript = path.join(process.env.HOME ?? "", ".config/herdr/local-plugins/pr-review/collect.sh");
const setupOf = (outputs: Record<string, unknown>) => outputs.setup as Setup;
const workOf = (outputs: Record<string, unknown>) => (outputs.check_comments as { work: Work[] }).work;

function feedbackText(setup: Setup, work?: Work[]) {
  const items = work ? work.flatMap((w) => w.items) : setup.items;
  return `Address this feedback on PR #${setup.pr} (${setup.repo}):
${items.map((i) => `- [${i.kind}] ${i.where}${i.author ? ` @${i.author}` : ""}: ${i.body} (${i.url})`).join("\n")}`;
}

function gh(repository: string, ...args: string[]) {
  return execFileSync("gh", args, { cwd: repository, encoding: "utf8" });
}

export default defineWorkflow({
  name: "address-feedback",
  title: ({ input }) => `address-feedback: ${path.basename(String((input as { file?: string }).file ?? ""))}`,
  // A missing or bad batch must not throw here: that crashes the runner in a
  // loop. Without a usable file, setup collects the feedback itself.
  input: (value) => {
    const file = (value as { file?: string } | null)?.file;
    return { file: file && fs.existsSync(file) ? file : null };
  },
  startAt: "start",
  maxSteps: 300,
  nodes: {
    start: agent({
      statusDetail: "reading the repo",
      prompt: ({ input }) => {
        const file = (input as { file: string | null }).file;
        const intro = file
          ? (() => {
              const batch = JSON.parse(fs.readFileSync(file, "utf8")) as Batch;
              return `The PR review tab found new feedback on ${batch.url} (${batch.items.length} item(s)). Prepare to address it.`;
            })()
          : "I started this by hand: address the open feedback on the current branch's PR.";
        return `${ORCHESTRATOR}

${intro}

Run \`git rev-parse --show-toplevel\`, \`git branch --show-current\`, \`gh pr view --json number,headRefName -q '"\\(.number) \\(.headRefName)"'\`, \`gh repo view --json nameWithOwner -q .nameWithOwner\`, \`git rev-parse origin/<branch>\` and \`echo $HERDR_PANE_ID\`. The current branch must be the PR's branch.`;
      },
      expectedOutput: `{ "repository": "<absolute repo root>", "branch": "...", "base": "<sha of origin/<branch>, the last pushed commit>", "piPane": "<HERDR_PANE_ID>", "repo": "<owner/name>", "pr": <PR number> }`,
      validate: (output) => {
        const start = output as { repository: string };
        if (!path.isAbsolute(start.repository) || !fs.existsSync(path.join(start.repository, ".git")))
          throw new Error("repository must be the absolute git root");
        return output;
      },
    }),

    setup: action({
      effect: manualEffect("address-feedback.setup"),
      run: ({ input, outputs, state }) => {
        const start = outputs.start as { repository: string; branch: string; base: string; piPane: string; repo: string; pr: number };
        const file = (input as { file: string | null }).file;
        const batch = (
          file
            ? JSON.parse(fs.readFileSync(file, "utf8"))
            : JSON.parse(execFileSync("bash", [collectScript, start.repo, String(start.pr)], { encoding: "utf8" }))
        ) as Batch;
        const runDir = runDirFor(start.repository, state.runId);
        if (batch.items.length === 0) {
          return { ...start, ...batch, runDir, marker: "", task: "", route: "nothing" };
        }
        // Watchers hold new feedback while this marker exists.
        fs.mkdirSync(activeDir, { recursive: true });
        const marker = path.join(activeDir, `${batch.repo.replace("/", "_")}_${batch.pr}`);
        fs.writeFileSync(marker, `${state.runId}\n`);
        writeJson(path.join(runDir, "feedback.json"), batch);
        const setup: Setup = { ...start, ...batch, runDir, marker, task: "" };
        setup.task = feedbackText(setup);
        fs.writeFileSync(path.join(runDir, "task.md"), `${setup.task}\n`);
        return { ...setup, route: "address" };
      },
    }),

    // CI failures are fixed directly; comments get the skeptical check first.
    check_comments: action({
      effect: manualEffect("address-feedback.check-comments"),
      statusDetail: "checking review comments",
      timeoutMs: 30 * MINUTE,
      run: async ({ outputs }) => {
        trackPi(outputs);
        const setup = setupOf(outputs);
        const ci = setup.items.filter((i) => i.kind === "ci");
        const comments = setup.items.filter((i) => i.kind !== "ci");
        let decisions: { id: string; decision: "fix" | "skip"; reason: string }[] = [];
        if (comments.length) {
          const result = await runClaude<{ items: typeof decisions }>({
            role: "checker",
            cwd: setup.repository,
            runDir: setup.runDir,
            schema: checkSchema,
            prompt: `For each review comment on PR #${setup.pr} below, decide "fix" or "skip". The PR's change is git diff origin/main...HEAD; the comment may be from a person or a review bot.

${CHECK_RULES}

${JSON.stringify(comments.map((c) => ({ id: c.key, where: c.where, author: c.author, comment: c.body })), null, 2)}`,
          });
          decisions = result.output.items;
        }
        const fix = new Set(decisions.filter((d) => d.decision === "fix").map((d) => d.id));
        const work: Work[] = [
          ...(ci.length ? [{ kind: "ci" as const, items: ci }] : []),
          ...comments.filter((c) => fix.has(c.key)).map((c) => ({ kind: "comment" as const, items: [c] })),
        ];
        writeJson(path.join(setup.runDir, "checked-comments.json"), decisions);
        return { work, decisions };
      },
    }),

    // An action, not compute: it records the commit each finished item left
    // at HEAD (after any in-place verify fixes) for the GitHub replies.
    next_item: action({
      effect: manualEffect("address-feedback.next-item"),
      run: ({ outputs }) => {
        const setup = setupOf(outputs);
        const previous = outputs.next_item as { index: number; head: string; commits: Record<string, string> } | undefined;
        const head = git(setup.repository, "rev-parse", "HEAD");
        const commits = { ...(previous?.commits ?? {}) };
        if (previous && previous.index >= 0 && head !== previous.head) {
          for (const item of workOf(outputs)[previous.index]?.items ?? []) commits[item.key] = head;
        }
        const index = (previous?.index ?? -1) + 1;
        const route = index < workOf(outputs).length ? "implement" : "done";
        return { route, index, head, commits };
      },
    }),

    implement_item: implementNode("addressing feedback", (outputs) => {
      const setup = setupOf(outputs);
      const work = workOf(outputs)[(outputs.next_item as { index: number }).index];
      const retry = (outputs.item_escalation as { input?: { instructions?: string } } | undefined)?.input?.instructions;
      const brief =
        work.kind === "ci"
          ? `CI failed on PR #${setup.pr}:
${work.items.map((i) => `- ${i.where}: ${i.url}`).join("\n")}

Read the failing logs (\`gh run view <run-id> --log-failed\`). If this PR caused a failure, fix it as one commit. If a failure is unrelated to this PR (flaky or broken on main), don't touch it; say so in notes and report status "done" with commit null.`
          : `Address this review comment on PR #${setup.pr} as one atomic commit, minimally:
${work.items.map((i) => `${i.where} (@${i.author}): ${i.body}\n${i.url}`).join("\n")}`;
      return `${brief}${retry ? `\n\nPrevious attempt failed. My instructions: ${retry}` : ""}`;
    }),

    implement_gate: implementGate("address-feedback.implement-gate", "implement_item"),
    item_escalation: escalation("address-feedback", "Couldn't address an item", (o) => {
      const r = o.implement_item as { status: string; summary: string; notes: string };
      return `Item ${(o.next_item as { index: number }).index + 1} ended with status "${r.status}": ${r.summary} ${r.notes}`;
    }),

    verify: verifyNode("address-feedback.verify"),
    verify_gate: attemptGate("verify_gate", (o) => !(o.verify as { passed: boolean }).passed, "passed", "fix"),
    fix_verify: fixVerifyNode((o) => feedbackText(setupOf(o), workOf(o))),

    has_commits: action({
      effect: manualEffect("address-feedback.has-commits"),
      run: ({ outputs }) => ({ route: commitsSince(setupOf(outputs)).length ? "review" : "approve" }),
    }),

    final_review: finalReviewNode("address-feedback.final-review"),
    check_findings: checkFindingsNode("address-feedback.check-findings"),
    review_gate: attemptGate("review_gate", (o) => (o.check_findings as { blocking: unknown[] }).blocking.length > 0, "approved", "fix"),
    fix_review: fixReviewNode((o) => feedbackText(setupOf(o), workOf(o))),
    fix_escalation: fixEscalation("address-feedback"),

    approve: humanDecision({
      audience: "operator",
      choices: pushChoices,
      request: ({ outputs }) => {
        const setup = setupOf(outputs);
        const commits = commitsSince(setup);
        const { decisions } = outputs.check_comments as { decisions: { id: string; decision: string; reason: string }[] };
        const replies = setup.items
          .filter((i) => i.kind !== "ci")
          .map((i) => {
            const d = decisions.find((x) => x.id === i.key);
            return d?.decision === "fix"
              ? `${i.where} @${i.author}: reply "Fixed in <sha>" and resolve`
              : `${i.where} @${i.author}: reply "${d?.reason ?? "skipped"}"${i.authorIsBot ? " and resolve" : ", leave open"}`;
          });
        const noted = (outputs.check_findings as { noted?: Finding[] } | undefined)?.noted ?? [];
        notify("address-feedback: ready", `PR #${setup.pr}: ${commits.length} commit(s), ${replies.length} reply(ies)`);
        return {
          title: commits.length ? `Push ${commits.length} fix(es) to PR #${setup.pr} and reply?` : `Reply on PR #${setup.pr}?`,
          subject: { commits, replies, runDir: setup.runDir },
          presentation: {
            schema: "pi-workflows.decision-presentation.v1",
            summary: `${commits.length} commit(s) to push, ${replies.length} GitHub reply(ies).`,
            blocks: [
              { kind: "section", title: "Commits" },
              { kind: "bullets", items: commits.length ? commits : ["none"] },
              { kind: "section", title: "Replies" },
              { kind: "bullets", items: replies.length ? replies : ["none"] },
              { kind: "section", title: "Noted, not blocking" },
              { kind: "bullets", items: noted.length ? noted.map((f) => `${f.file}: ${f.problem}`) : ["none"] },
              { kind: "paragraph", text: `Run files: ${setup.runDir}` },
            ],
          },
        };
      },
    }),

    fix_user: fixUserNode((o) => feedbackText(setupOf(o), workOf(o)), ["approve", "fix_escalation"]),

    push_route: action({
      effect: manualEffect("address-feedback.push-route"),
      run: ({ outputs }) => ({ route: commitsSince(setupOf(outputs)).length ? "push" : "reply" }),
    }),

    push: shell({
      effect: manualEffect("address-feedback.push"),
      statusDetail: "pushing",
      exec: ({ outputs }) => ({
        command: "git",
        args: ["push", "origin", "HEAD"],
        cwd: setupOf(outputs).repository,
        timeoutMs: 5 * MINUTE,
      }),
    }),

    update_pr: action({
      effect: manualEffect("address-feedback.update-pr"),
      statusDetail: "updating the PR description",
      timeoutMs: 20 * MINUTE,
      run: async ({ outputs }) => {
        const setup = setupOf(outputs);
        const result = await runClaude({
          role: "prMaintenance",
          cwd: setup.repository,
          runDir: setup.runDir,
          prompt: `New commits were pushed to PR #${setup.pr} (${setup.url}). Use the Skill tool to run the repo's pull-request-maintenance skill if it has one, only to keep the PR title and description in sync with the latest diff. Don't reply to or resolve review comments; that is handled separately.`,
        });
        return { summary: String(result.output).slice(0, 2000) };
      },
    }),

    reply: action({
      effect: manualEffect("address-feedback.reply"),
      statusDetail: "replying on GitHub",
      timeoutMs: 10 * MINUTE,
      run: ({ outputs }) => {
        const setup = setupOf(outputs);
        const { decisions } = outputs.check_comments as { decisions: { id: string; decision: string; reason: string }[] };
        const commits = (outputs.next_item as { commits: Record<string, string> }).commits;
        const [owner, repo] = setup.repo.split("/");
        const summary: string[] = [];
        const done: string[] = [];
        for (const item of setup.items.filter((i) => i.kind !== "ci")) {
          const d = decisions.find((x) => x.id === item.key);
          const sha = commits[item.key];
          const fixed = d?.decision === "fix" && sha;
          const body = fixed ? `Fixed in ${sha.slice(0, 10)}.` : `Not changing this: ${d?.reason ?? "out of scope for this PR"}.`;
          if (item.kind === "thread" && item.commentId) {
            gh(setup.repository, "api", `repos/${owner}/${repo}/pulls/${setup.pr}/comments/${item.commentId}/replies`, "-f", `body=${body}`);
            if ((fixed || item.authorIsBot) && item.threadId) {
              gh(setup.repository, "api", "graphql", "-f", `query=mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}`, "-f", `id=${item.threadId}`);
            }
          } else {
            summary.push(`- @${item.author} (${item.url}): ${body}`);
          }
          done.push(item.key);
        }
        if (summary.length) gh(setup.repository, "pr", "comment", String(setup.pr), "--body", summary.join("\n"));
        return { replied: done.length };
      },
    }),

    wrap_done: wrapNode("address-feedback.wrap-done", (o) => fs.rmSync(setupOf(o).marker, { force: true })),
    wrap_stop: wrapNode("address-feedback.wrap-stop", (o) => setupOf(o)?.marker && fs.rmSync(setupOf(o).marker, { force: true })),

    done: notifyNode({
      kind: "final",
      message: ({ outputs }) => {
        const setup = setupOf(outputs);
        notify("address-feedback: done", `PR #${setup.pr}`, "done");
        return `Feedback on PR #${setup.pr} addressed. Run files: ${setup.runDir}`;
      },
    }),
    nothing: notifyNode({
      kind: "final",
      message: ({ outputs }) => `No open feedback on PR #${setupOf(outputs).pr}: no failed checks and no open comments to address.`,
    }),
    stopped: notifyNode({
      kind: "final",
      message: ({ outputs }) => `Stopped. Run files: ${setupOf(outputs)?.runDir ?? "none"}`,
    }),
  },
  edges: [
    { from: "start", to: "setup" },
    { from: "setup", switch: { on: "$.route", cases: { address: "check_comments", nothing: "nothing" } } },
    { from: "check_comments", to: "next_item" },
    { from: "next_item", switch: { on: "$.route", cases: { implement: "implement_item", done: "has_commits" } } },
    { from: "implement_item", to: "implement_gate" },
    { from: "implement_gate", switch: { on: "$.route", cases: { verify: "verify", escalate: "item_escalation" } } },
    humanDecisionEdge({ from: "item_escalation", choices: retryChoices, cases: { retry: "implement_item", stop: "wrap_stop" } }),
    { from: "verify", to: "verify_gate" },
    { from: "verify_gate", switch: { on: "$.route", cases: { passed: "next_item", fix: "fix_verify", escalate: "fix_escalation" } } },
    { from: "fix_verify", to: "verify" },
    { from: "has_commits", switch: { on: "$.route", cases: { review: "final_review", approve: "approve" } } },
    { from: "final_review", to: "check_findings" },
    { from: "check_findings", to: "review_gate" },
    { from: "review_gate", switch: { on: "$.route", cases: { approved: "approve", fix: "fix_review", escalate: "fix_escalation" } } },
    { from: "fix_review", to: "verify" },
    humanDecisionEdge({ from: "fix_escalation", choices: retryChoices, cases: { retry: "fix_user", stop: "wrap_stop" } }),
    humanDecisionEdge({ from: "approve", choices: pushChoices, cases: { push: "push_route", fix: "fix_user", stop: "wrap_stop" } }),
    { from: "fix_user", to: "verify" },
    { from: "push_route", switch: { on: "$.route", cases: { push: "push", reply: "reply" } } },
    { from: "push", to: "update_pr" },
    { from: "update_pr", to: "reply" },
    { from: "reply", to: "wrap_done" },
    { from: "wrap_done", to: "done" },
    { from: "wrap_stop", to: "stopped" },
  ],
});
