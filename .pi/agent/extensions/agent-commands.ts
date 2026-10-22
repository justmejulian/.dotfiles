import os from "node:os";
import path from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { readAgents, sourceDirectory } from "../launchers/pi-agent.mjs";
import { createHerdrTabSurface, getHerdrCurrentPane, runHerdrPaneCommand, closeHerdrTab } from "../git/github.com/edxeth/pi-subagents/src/mux/herdr.ts";

const shellArgument = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

export default async function agentCommands(pi: ExtensionAPI): Promise<void> {
  const agents = await readAgents(sourceDirectory());
  const enabled = agents.filter(agent => agent.metadata.enabled !== false);
  const known = new Set(enabled.map(agent => agent.name));

  async function open(name: string, task: string, ctx: ExtensionCommandContext): Promise<void> {
    if (!known.has(name)) throw new Error(`Unknown or disabled agent: ${name}`);
    if (process.env.HERDR_ENV !== "1" || !process.env.HERDR_PANE_ID) throw new Error("Direct agent tabs require a Herdr-managed pane.");
    const current = (await readAgents(sourceDirectory())).find(agent => agent.name === name);
    if (!current || current.metadata.enabled === false) throw new Error(`Agent unavailable: ${name}; reload to refresh commands.`);
    await ctx.waitForIdle();
    const parent = getHerdrCurrentPane();
    const surface = createHerdrTabSurface({ label: `[${name}] Direct chat`, cwd: ctx.cwd, workspaceId: parent.workspaceId, focus: true });
    const launcher = path.join(os.homedir(), ".local/bin/pi-agent");
    const args = [launcher, name, ...(task.trim() ? ["--", task] : [])];
    const command = `cd ${shellArgument(ctx.cwd)} && exec ${args.map(shellArgument).join(" ")}`;
    try {
      runHerdrPaneCommand(surface.pane.paneId, command);
    } catch (error) {
      closeHerdrTab(surface.tab.tabId);
      throw error;
    }
    ctx.ui.notify(`Opened ${name} for direct chat. This is a standalone session, not a managed child of this conversation.`, "info");
  }

  const registered = new Set(["subagents"]);
  if (!registered.has("agent")) {
    pi.registerCommand("agent", {
      description: "Open a named agent directly: /agent NAME [task]. No task opens an idle conversation.",
      handler: async (args, ctx) => {
        const match = args.trim().match(/^(\S+)(?:\s+([\s\S]*))?$/);
        if (!match) {
          ctx.ui.notify(`Agents: ${enabled.map(agent => agent.name).join(", ")}. Use /agent NAME [task].`, "info");
          return;
        }
        try { await open(match[1], match[2] ?? "", ctx); }
        catch (error) { ctx.ui.notify(`Agent launch failed: ${error instanceof Error ? error.message : String(error)}. Outside Herdr, use pi-agent NAME in a terminal.`, "error"); }
      },
    });
    registered.add("agent");
  }
  for (const agent of enabled) {
    if (registered.has(agent.name)) continue;
    pi.registerCommand(agent.name, {
      description: `Open ${agent.name} directly in a Herdr tab; optional task, otherwise idle.`,
      handler: async (args, ctx) => {
        try { await open(agent.name, args, ctx); }
        catch (error) { ctx.ui.notify(`Agent launch failed: ${error instanceof Error ? error.message : String(error)}. Outside Herdr, use pi-agent ${agent.name}.`, "error"); }
      },
    });
  }
}
