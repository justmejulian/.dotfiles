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
  const pending = interview.decisions.filter((decision) => !decision.reviewed);
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
