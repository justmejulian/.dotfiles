// Headless Claude Code runs for the develop and address-feedback workflows.
//
// Each role has a fixed model, effort and tool allowlist. Claude returns JSON
// validated against the caller's schema (--json-schema); the workflow writes
// any files itself, so no role has write access. Every run keeps its full
// stream-json transcript and appends one line to <runDir>/stats.jsonl.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const OPUS = "claude-opus-5-5";
const SONNET = "claude-sonnet-5-5";

const READ = ["Read", "Grep", "Glob"];
const GIT_READ = ["Bash(git diff *)", "Bash(git log *)", "Bash(git show *)", "Bash(git rev-parse *)"];
const SUBAGENTS = "Agent(workflow-explorer,workflow-planner)";
const LINEAR = ["get_issue", "list_comments", "get_attachment", "extract_images"].map(
  (tool) => `mcp__claude_ai_Linear__${tool}`,
);
// Read-only. Haiku can't use the claude.ai Slack connector headless, so the
// slack role runs on Sonnet at low effort.
const SLACK = ["slack_read_thread", "slack_read_channel", "slack_read_user_profile"].map(
  (tool) => `mcp__claude_ai_Slack__${tool}`,
);

export type ClaudeRole =
  | "intake"
  | "slack"
  | "planner"
  | "planReview"
  | "finalReview"
  | "checker"
  | "prWriter"
  | "prMaintenance";

interface RoleConfig {
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  tools: string[];
  /** Sub-agents the role is told to use; a run that skips one gets a warning. */
  expectSubagents?: string[];
}

export const roles: Record<ClaudeRole, RoleConfig> = {
  intake: { model: SONNET, effort: "low", tools: [...READ, ...LINEAR] },
  slack: { model: SONNET, effort: "low", tools: SLACK },
  planner: {
    model: OPUS,
    effort: "xhigh",
    tools: [...READ, SUBAGENTS],
    expectSubagents: ["workflow-explorer", "workflow-planner"],
  },
  planReview: {
    model: OPUS,
    effort: "high",
    tools: [...READ, SUBAGENTS],
    expectSubagents: ["workflow-explorer"],
  },
  // Runs Matt's code-review skill (which starts its own sub-agents) and the
  // repo's review-changes skill (which fetches the CI review prompt).
  finalReview: {
    model: OPUS,
    effort: "xhigh",
    tools: [...READ, ...GIT_READ, "Skill", "Agent", "WebFetch(domain:raw.githubusercontent.com)"],
  },
  checker: {
    model: OPUS,
    effort: "high",
    tools: [...READ, ...GIT_READ, "Agent(workflow-explorer)"],
  },
  prWriter: {
    model: SONNET,
    effort: "medium",
    tools: [...READ, ...GIT_READ, "Skill", "Bash(git status *)", "Bash(gh pr create *)", "Bash(gh pr view *)"],
  },
  prMaintenance: {
    model: SONNET,
    effort: "medium",
    tools: [...READ, ...GIT_READ, "Skill", "Bash(gh pr view *)", "Bash(gh pr edit *)"],
  },
};

export interface ClaudeRunOptions {
  role: ClaudeRole;
  prompt: string;
  /** Repository the run works in. */
  cwd: string;
  /** Run folder: transcripts and stats.jsonl go here. */
  runDir: string;
  /** JSON Schema for the answer; without it the answer is plain text. */
  schema?: object;
  /** Keep the session so a later call can continue it (planner interview). */
  sessionId?: string;
  /** Continue a session started with sessionId. */
  resume?: string;
  timeoutMs?: number;
}

export interface ClaudeRunResult<T = unknown> {
  output: T;
  sessionId: string;
  costUsd: number;
  durationMs: number;
  turns: number;
  subagentsUsed: string[];
  warnings: string[];
  transcript: string;
}

export async function runClaude<T = unknown>(options: ClaudeRunOptions): Promise<ClaudeRunResult<T>> {
  const role = roles[options.role];
  const transcriptDir = path.join(options.runDir, "claude");
  fs.mkdirSync(transcriptDir, { recursive: true });
  const transcript = path.join(transcriptDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${options.role}.jsonl`);

  const args = [
    "-p",
    options.prompt,
    "--model",
    role.model,
    "--effort",
    role.effort,
    "--output-format",
    "stream-json",
    "--verbose",
    "--allowedTools",
    role.tools.join(" "),
    "--permission-prompts",
    "none",
  ];
  if (options.schema) args.push("--json-schema", JSON.stringify(options.schema));
  if (options.resume) args.push("--resume", options.resume);
  else if (options.sessionId) args.push("--session-id", options.sessionId);
  else args.push("--no-session-persistence");

  const started = Date.now();
  const lines = await run("claude", args, options.cwd, transcript, options.timeoutMs ?? 45 * 60_000);
  const events = lines.flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });

  const result = events.findLast((event) => event.type === "result");
  const subagentsUsed = [
    ...new Set(
      events
        .filter((event) => event.type === "assistant")
        .flatMap((event) => event.message?.content ?? [])
        .filter((part) => part.type === "tool_use" && part.name === "Agent")
        .map((part) => String(part.input?.subagent_type ?? "general-purpose")),
    ),
  ];
  const warnings = (role.expectSubagents ?? [])
    .filter((name) => !subagentsUsed.includes(name))
    .map((name) => `${options.role} did not use ${name}`);

  // A resumed session reports its running total, so record only this call's
  // share, using what earlier calls in the session cost.
  const sessionCosts = path.join(options.runDir, "claude", "session-costs.json");
  const costs: Record<string, number> = fs.existsSync(sessionCosts)
    ? JSON.parse(fs.readFileSync(sessionCosts, "utf8"))
    : {};
  const total = result?.total_cost_usd ?? 0;
  const costUsd = result?.session_id ? total - (costs[result.session_id] ?? 0) : total;
  if (result?.session_id) {
    costs[result.session_id] = total;
    fs.writeFileSync(sessionCosts, JSON.stringify(costs, null, 2));
  }

  const stats = {
    at: new Date().toISOString(),
    kind: "claude",
    role: options.role,
    model: role.model,
    effort: role.effort,
    outcome: !result ? "no-result" : result.is_error ? `error:${result.subtype}` : "ok",
    costUsd,
    durationMs: result?.duration_ms ?? Date.now() - started,
    turns: result?.num_turns ?? 0,
    usage: result?.modelUsage ?? null,
    subagentsUsed,
    warnings,
    transcript,
  };
  fs.appendFileSync(path.join(options.runDir, "stats.jsonl"), `${JSON.stringify(stats)}\n`);

  if (!result || result.is_error) {
    throw new Error(`claude ${options.role} failed (${stats.outcome}); transcript: ${transcript}`);
  }
  const output = options.schema ? result.structured_output : result.result;
  if (options.schema && output === undefined) {
    throw new Error(`claude ${options.role} returned no structured output; transcript: ${transcript}`);
  }

  return {
    output: output as T,
    sessionId: result.session_id,
    costUsd: stats.costUsd,
    durationMs: stats.durationMs,
    turns: stats.turns,
    subagentsUsed,
    warnings,
    transcript,
  };
}

export const newSessionId = randomUUID;

/** Runs a command, writes stdout to `transcript` as it arrives, returns its lines. */
function run(command: string, args: string[], cwd: string, transcript: string, timeoutMs: number) {
  return new Promise<string[]>((resolve, reject) => {
    const file = fs.createWriteStream(transcript);
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CLAUDE_CODE_FORK_SUBAGENT: "0" }, // wait for sub-agents
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buffer = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      file.write(chunk);
      buffer += chunk;
    });
    child.stderr.on("data", (chunk) => (stderr += chunk));
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      file.end();
      if (signal) return reject(new Error(`${command} stopped by ${signal} after ${timeoutMs} ms`));
      if (code !== 0 && !buffer.includes('"type":"result"')) {
        return reject(new Error(`${command} exited ${code}: ${stderr.slice(-2000)}`));
      }
      resolve(buffer.split("\n").filter(Boolean));
    });
  });
}
