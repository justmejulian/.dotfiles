import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

interface AgentProfile {
  schema: string;
  name: string;
  body: string;
  direct: string[];
  hashes: Record<string, string>;
  profile: string;
  tools: string[] | null;
  deny: string[];
}

const spawnTools = ["subagent", "subagent_resume", "subagent_kill"];

function loadProfile(): AgentProfile {
  const file = process.env.PI_AGENT_PROFILE;
  if (!file) throw new Error("Named-agent profile was not provided; use pi-agent.");
  const profile = JSON.parse(fs.readFileSync(file, "utf8")) as AgentProfile;
  if (profile.schema !== "pi-agent-profile.v1" || !profile.name || !profile.body || !Array.isArray(profile.direct) || !Array.isArray(profile.deny) || (profile.tools !== null && !Array.isArray(profile.tools))) {
    throw new Error("Invalid named-agent profile; relaunch with pi-agent.");
  }
  return profile;
}

function validateCatalog(profile: AgentProfile, cwd: string): void {
  for (const [name, expectedHash] of Object.entries(profile.hashes)) {
    const file = path.join(profile.profile, "agents", `${name}.md`);
    const actual = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    if (actual !== expectedHash) throw new Error(`Generated agent changed: ${name}. Relaunch pi-agent.`);
  }
  const project = path.join(cwd, ".pi/agents");
  if (!fs.existsSync(project)) return;
  for (const filename of fs.readdirSync(project).filter(file => file.endsWith(".md"))) {
    const { frontmatter } = parseFrontmatter(fs.readFileSync(path.join(project, filename), "utf8"));
    const name = String(frontmatter.name || filename.slice(0, -3));
    if (name in profile.hashes) throw new Error(`Project agent shadows the named profile's ${name}; resolve the override before launching.`);
  }
}

export default function namedAgentProfile(pi: ExtensionAPI): void {
  const profile = loadProfile();
  const denied = new Set(profile.deny);
  let initialized = false;

  function applyTools(ctx: ExtensionContext): void {
    validateCatalog(profile, ctx.cwd);
    const available = new Set(pi.getAllTools().map(tool => tool.name));
    const requested = profile.tools ?? pi.getActiveTools();
    const selected = [...new Set([...requested, ...(profile.direct.length ? spawnTools : [])])].filter(name => !denied.has(name));
    const missing = selected.filter(name => !available.has(name));
    if (missing.length) throw new Error(`Missing named-agent tools: ${missing.join(", ")}`);
    pi.setActiveTools(selected);
    initialized = true;
  }

  pi.on("session_start", (_event, ctx) => {
    applyTools(ctx);
    if (ctx.hasUI) ctx.ui.setStatus("named-agent", profile.name);
  });

  pi.on("before_agent_start", (event, ctx) => {
    applyTools(ctx);
    if (event.messageType !== "user" && !ctx.sessionManager.getBranch().some(entry => entry.type === "message" && entry.message.role === "user")) {
      throw new Error("Named agent is idle; send a message before starting background continuation.");
    }
    event.systemPromptOptions.customPrompt = `${profile.body}\n\nStandalone named-agent session: the human chats directly with you. There is no launching parent to answer caller_ping. Ask the human directly instead. Stay open after replies. Role auto-exit and parent-only visibility apply to managed subagent launches, not this manual session. Use only your configured tools and permitted child agents. Never infer permission to edit, commit or publish from opening this session.`;
  });

  pi.on("tool_call", (event, ctx) => {
    try {
      if (!initialized) applyTools(ctx);
      if (denied.has(event.toolName) || (profile.tools !== null && ![...profile.tools, ...(profile.direct.length ? spawnTools : [])].includes(event.toolName))) {
        return { block: true, reason: `Tool unavailable to ${profile.name}: ${event.toolName}` };
      }
      if (profile.tools === null && !profile.direct.length && spawnTools.includes(event.toolName)) {
        return { block: true, reason: "This agent has no child-agent grant." };
      }
      if (event.toolName === "subagent") {
        const input = event.input as { agent?: unknown; cwd?: unknown; children?: unknown[] };
        const children = Array.isArray(input.children) ? input.children : [input];
        for (const raw of children) {
          const child = raw as { agent?: unknown; cwd?: unknown };
          if (typeof child.agent !== "string" || !profile.direct.includes(child.agent)) throw new Error("Agent is outside this role's spawning allowlist.");
          const cwd = typeof child.cwd === "string" ? path.resolve(ctx.cwd, child.cwd) : ctx.cwd;
          validateCatalog(profile, cwd);
        }
      }
    } catch (error) {
      return { block: true, reason: error instanceof Error ? error.message : String(error) };
    }
  });
}
