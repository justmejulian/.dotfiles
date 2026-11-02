// Headless Claude Code transport for the standalone read-only connector bridges.
// Keeps local transcripts and usage receipts; it has no workflow dependency.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SONNET = "claude-sonnet-5-5";

// Read-only. Haiku can't use the claude.ai Slack connector headless, so the
// slack role runs on Sonnet at low effort.
const SLACK = ["slack_read_thread", "slack_read_channel", "slack_read_user_profile"].map(
  (tool) => `mcp__claude_ai_Slack__${tool}`,
);

const LINEAR = ["get_issue", "list_comments", "get_attachment", "extract_images"].map(
  (tool) => `mcp__claude_ai_Linear__${tool}`,
);

const CONNECTOR_DISCOVERY = ["ToolSearch", "WaitForMcpServers"];

export type ClaudeRole = "slack" | "slack-search" | "slack-search-private" | "linear";

interface RoleConfig {
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  tools: string[];
  /** Sub-agents the role is told to use; a run that skips one gets a warning. */
  expectSubagents?: string[];
}

export const roles: Record<ClaudeRole, RoleConfig> = {
  slack: { model: SONNET, effort: "low", tools: [...SLACK, ...CONNECTOR_DISCOVERY] },
  "slack-search": { model: SONNET, effort: "low", tools: ["mcp__claude_ai_Slack__slack_search_public", ...CONNECTOR_DISCOVERY] },
  "slack-search-private": { model: SONNET, effort: "low", tools: ["mcp__claude_ai_Slack__slack_search_public_and_private", ...CONNECTOR_DISCOVERY] },
  linear: { model: SONNET, effort: "low", tools: [...LINEAR, ...CONNECTOR_DISCOVERY] },
};

function readOnlyArgs(role: RoleConfig): string[] {
  const permitted = [...role.tools, "StructuredOutput"].join("|");
  return [
    "--tools", CONNECTOR_DISCOVERY.join(","),
    "--permission-mode", "dontAsk",
    "--disable-slash-commands",
    "--settings", JSON.stringify({
      disableAllHooks: false,
      hooks: {
        PreToolUse: [{
          matcher: `^(?!(?:${permitted})$)`,
          hooks: [{ type: "command", command: "echo 'Only the selected read-only connector tools are permitted.' >&2; exit 2" }],
        }],
      },
    }),
  ];
}

export interface ClaudeRunOptions {
  role: ClaudeRole;
  prompt: string;
  /** Repository the run works in. */
  cwd: string;
  /** Run folder: transcripts and stats.jsonl go here. */
  runDir: string;
  /** JSON Schema for the answer; without it the answer is plain text. */
  schema?: object;
  /** Optional explicit session persistence for callers that need it. */
  sessionId?: string;
  /** Continue a session started with sessionId. */
  resume?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
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
  args.push(...readOnlyArgs(role));
  if (options.schema) args.push("--json-schema", JSON.stringify(options.schema));
  if (options.resume) args.push("--resume", options.resume);
  else if (options.sessionId) args.push("--session-id", options.sessionId);
  else args.push("--no-session-persistence");

  const started = Date.now();
  const lines = await run("claude", args, options.cwd, transcript, options.timeoutMs ?? 45 * 60_000, options.signal);
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

const MAX_STDOUT_BYTES = 4 * 1024 * 1024;
const MAX_STDERR_CHARS = 2000;

/** Runs a command, writes stdout to `transcript` as it arrives, returns its lines. */
function run(command: string, args: string[], cwd: string, transcript: string, timeoutMs: number, signal?: AbortSignal) {
  return new Promise<string[]>((resolve, reject) => {
    signal?.throwIfAborted();
    const file = fs.createWriteStream(transcript);
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CLAUDE_CODE_FORK_SUBAGENT: "0" }, // wait for sub-agents
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    let buffer = "";
    let stderr = "";
    let stdoutBytes = 0;
    let oversized = false;
    let stopRequested = false;
    child.stdout.on("data", (chunk: Buffer) => {
      if (oversized) return;
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        oversized = true;
        stop();
        return;
      }
      file.write(chunk);
      buffer += chunk;
    });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-MAX_STDERR_CHARS); });
    const stop = () => {
      if (stopRequested || !child.pid) return;
      stopRequested = true;
      try {
        if (process.platform === "win32") child.kill("SIGKILL");
        else process.kill(-child.pid, "SIGKILL");
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    };
    const timer = setTimeout(stop, timeoutMs);
    signal?.addEventListener("abort", stop, { once: true });
    if (signal?.aborted) stop();
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", stop); file.end(); };
    child.on("error", (error) => { cleanup(); reject(error); });
    child.on("close", (code, stopped) => {
      cleanup();
      if (oversized) return reject(new Error(`${command} output exceeded ${MAX_STDOUT_BYTES} bytes; transcript is incomplete`));
      if (stopped || signal?.aborted) return reject(new Error(`${command} stopped (${stopped ?? "cancelled"})`));
      if (code !== 0 && !buffer.includes('"type":"result"')) {
        return reject(new Error(`${command} exited ${code}: ${stderr.slice(-2000)}`));
      }
      resolve(buffer.split("\n").filter(Boolean));
    });
  });
}
