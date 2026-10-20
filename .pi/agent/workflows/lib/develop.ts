// Helpers shared by develop.workflow.ts and address-feedback.workflow.ts:
// run folders, verify commands, repo skills, herdr notifications and the
// planner interview's decision log.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const workflowsDir = path.join(os.homedir(), ".pi/agent/workflows");

/** Repo name of the main checkout, so worktrees of `app` are all "app". */
export function repoName(repository: string): string {
  const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: repository,
    encoding: "utf8",
  }).trim();
  return path.basename(path.dirname(common));
}

export function runDirFor(repository: string, runId: string): string {
  const dir = path.join(workflowsDir, "runs", repoName(repository), runId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : fallback;
}

export function writeJson(file: string, value: unknown) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** The repo's line from verify.conf (`<repo> = <command>`), if any. */
export function verifyCommand(repository: string): string | null {
  const conf = path.join(workflowsDir, "verify.conf");
  if (!fs.existsSync(conf)) return null;
  const name = repoName(repository);
  for (const line of fs.readFileSync(conf, "utf8").split("\n")) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.+?)\s*$/);
    if (match && match[1] === name) return match[2];
  }
  return null;
}

/** Whether the repo ships a skill (in .agents/skills or .claude/skills). */
export function hasSkill(repository: string, name: string): boolean {
  return [".agents/skills", ".claude/skills"].some((dir) =>
    fs.existsSync(path.join(repository, dir, name, "SKILL.md")),
  );
}

/** herdr notification; quietly does nothing outside herdr. */
export function notify(title: string, body: string, sound: "none" | "done" | "request" = "request") {
  const herdr = process.env.HERDR_BIN_PATH ?? "herdr";
  spawnSync(herdr, ["notification", "show", title, "--body", body, "--sound", sound], { stdio: "ignore" });
}

export function git(repository: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
}

// ---------------------------------------------------------------------------
// pi usage: the orchestrator session and its sub-agents (implementer, scout,
// fixer) write cost per message into ~/.pi/agent/sessions/<cwd>/. Record what
// was spent since the last call into stats.jsonl, per agent and model.

const sessionsRoot = path.join(os.homedir(), ".pi/agent/sessions");

function sessionDir(repository: string): string | null {
  const slug = `-${repository.replace(/\//g, "-")}--`;
  const direct = path.join(sessionsRoot, slug);
  return fs.existsSync(direct) ? direct : null;
}

export function recordPiUsage(runDir: string, repository: string) {
  const dir = sessionDir(repository);
  if (!dir) return;
  const marker = path.join(runDir, "pi-usage.json");
  const { since } = readJson<{ since: string }>(marker, {
    since: fs.statSync(path.join(runDir, "task.md"), { throwIfNoEntry: false })?.birthtime.toISOString() ?? new Date(0).toISOString(),
  });
  const now = new Date().toISOString();
  const totals = new Map<string, { agent: string; model: string; costUsd: number; tokens: number; turns: number; sessions: Set<string> }>();

  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (!name.endsWith(".jsonl") || fs.statSync(file).mtime.toISOString() < since) continue;
    let agent = "orchestrator";
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line) continue;
      const entry = JSON.parse(line);
      if (entry.customType === "pi-subagents_launch_metadata") agent = entry.data?.agent ?? agent;
      const message = entry.message;
      if (entry.type !== "message" || message?.role !== "assistant" || !message.usage) continue;
      if (entry.timestamp <= since || entry.timestamp > now) continue;
      const key = `${agent}|${message.model}`;
      const total = totals.get(key) ?? { agent, model: message.model, costUsd: 0, tokens: 0, turns: 0, sessions: new Set() };
      total.costUsd += message.usage.cost?.total ?? 0;
      total.tokens += message.usage.totalTokens ?? 0;
      total.turns += 1;
      total.sessions.add(name);
      totals.set(key, total);
    }
  }

  const stats = path.join(runDir, "stats.jsonl");
  for (const total of totals.values()) {
    fs.appendFileSync(
      stats,
      `${JSON.stringify({
        at: now,
        kind: "pi",
        role: total.agent,
        model: total.model,
        outcome: "ok",
        costUsd: total.costUsd,
        tokens: total.tokens,
        turns: total.turns,
        durationMs: 0,
        warnings: [],
        sessions: [...total.sessions],
      })}\n`,
    );
  }
  writeJson(marker, { since: now });
}

// ---------------------------------------------------------------------------
// Planner interview: every question, who settled it, and whether I reviewed it.

export type DecidedBy = "precedent" | "orchestrator" | "you" | "round limit";

export interface Decision {
  id: string;
  round: number;
  question: string;
  recommendation: string;
  /** Repo precedent the planner found, or why there is none. */
  precedent: string;
  answer?: string;
  reason?: string;
  decidedBy?: DecidedBy;
  /** Shown to me in a decisions review I approved. */
  reviewed: boolean;
  /** Replaced by a later decision (e.g. after my annotation). */
  supersededBy?: string;
}

export interface Interview {
  sessionId?: string;
  round: number;
  decisions: Decision[];
  /** Message for the planner's next round (answers or my annotations). */
  inbox?: string;
}

export const interviewFile = (runDir: string) => path.join(runDir, "interview.json");

export function loadInterview(runDir: string): Interview {
  return readJson<Interview>(interviewFile(runDir), { round: 0, decisions: [] });
}

export function saveInterview(runDir: string, interview: Interview) {
  writeJson(interviewFile(runDir), interview);
}

const sections: [DecidedBy, string][] = [
  ["you", "Decided by you"],
  ["precedent", "Decided from repo precedent"],
  ["orchestrator", "Decided by the orchestrator"],
  ["round limit", "Decided at the round limit (planner's recommendation)"],
];

/** decisions.md: only what I haven't approved yet, grouped by who decided. */
export function renderDecisions(task: string, interview: Interview): string {
  const pending = interview.decisions.filter((decision) => !decision.reviewed && !decision.supersededBy);
  const approved = interview.decisions.length - pending.length;
  const out = [
    "# Decisions for review",
    "",
    `Task: ${task.split("\n")[0]}`,
    "",
    approved > 0 ? `${approved} decision(s) you already approved are not repeated.\n` : "",
    "Annotate anything you disagree with as [an: ...]. No annotations, or `ok`, approves all. `stop` cancels the run.",
    "",
  ];
  for (const [by, title] of sections) {
    const group = pending.filter((decision) => decision.decidedBy === by);
    if (group.length === 0) continue;
    out.push(`## ${title}`, "");
    for (const decision of group) {
      out.push(
        `### ${decision.id}. ${decision.question}`,
        `Answer: ${decision.answer}`,
        `Why: ${decision.reason ?? ""}`,
        `Planner's recommendation: ${decision.recommendation}`,
        `Precedent: ${decision.precedent || "none found"}`,
        "",
      );
    }
  }
  return out.join("\n");
}

/** Current decisions: answered and not replaced by a later one. */
export function currentDecisions(interview: Interview): Decision[] {
  return interview.decisions.filter((decision) => decision.answer && !decision.supersededBy);
}

/**
 * How I answered the decisions review. A checkpoint answer arrives as
 * { answer }, either my own text or my annotated reply relayed by the
 * orchestrator. Annotations mean changes; a short approval in any wording
 * means approve; `stop` cancels; other text is treated as changes.
 */
export function parseReviewAnswer(raw: unknown): { route: "plan" | "changes" | "stop"; text: string } {
  const value = raw && typeof raw === "object" && "answer" in raw ? (raw as { answer: unknown }).answer : raw;
  const text = (typeof value === "string" ? value : JSON.stringify(value ?? "")).trim();
  const plain = text.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (/\[an:/i.test(text)) return { route: "changes", text };
  if (/^stop\b/.test(plain)) return { route: "stop", text };
  const approval = /^(ok|okay|yes|y|approve|approved|approve all|lgtm|looks good|looks good to me|go|go ahead|continue|fine|all good|agreed)( .{0,30})?$/;
  if (plain === "" || /annotated reply below/i.test(text) || (plain.length <= 40 && approval.test(plain))) {
    return { route: "plan", text };
  }
  return { route: "changes", text };
}
