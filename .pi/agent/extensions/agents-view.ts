import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { closeHerdrPane, renameHerdrPane, runHerdrPaneCommand, splitHerdrPane } from "../git/github.com/edxeth/pi-subagents/src/mux/herdr.ts";

/**
 * /agents toggles a Herdr split on the right that draws this session's
 * subagents as a live tree (agents-graph.mjs).
 *
 * Every pi process, nested subagents included, writes a snapshot of its own
 * running children to STATE_DIR/<pid>.json. A child's snapshot carries its
 * session file, which is what its parent recorded for it, so the viewer can
 * hang each child's children beneath it.
 *
 * pi-subagents keeps its running set behind a widget manager it publishes on
 * globalThis; reading it there avoids a second module instance of its state.
 */
const STATE_DIR = path.join(os.homedir(), ".pi/agent/agents-view");
const VIEWER = path.join(os.homedir(), ".pi/agent/bin/agents-graph.mjs");
const MANAGER_KEY = Symbol.for("pi-subagents/widget-manager");

type Running = {
  id: string; name: string; agent?: string; title?: string; task: string; startTime: number;
  activity?: string; toolUses?: number; modelRef?: string; sessionFile: string;
};
type Row = {
  id: string; name: string; agent?: string; title: string; startTime: number; endTime?: number;
  activity?: string; toolUses: number; model?: string; sessionFile: string;
};

function runningAgents(): Running[] {
  const manager = (globalThis as Record<PropertyKey, unknown>)[MANAGER_KEY] as { getAgents?: () => Iterable<Running> } | undefined;
  return manager?.getAgents ? [...manager.getAgents()] : [];
}

const shellArgument = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

export default function (pi: ExtensionAPI) {
  const stateFile = path.join(STATE_DIR, `${process.pid}.json`);
  const rows = new Map<string, Row>();
  let sessionFile: string | undefined;
  let label = "main";
  let lastWritten = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  let paneId: string | undefined;

  function poll(): void {
    const live = new Set<string>();
    for (const a of runningAgents()) {
      live.add(a.id);
      const title = (a.title ?? a.task).split("\n").find(l => l.trim())?.trim() ?? "";
      rows.set(a.id, {
        id: a.id, name: a.name, agent: a.agent, title, startTime: a.startTime, activity: a.activity,
        toolUses: a.toolUses ?? 0, model: a.modelRef, sessionFile: path.resolve(a.sessionFile),
      });
    }
    // Gone from the running set means finished; pi-subagents' own result
    // says how, so the graph only marks it done.
    for (const row of rows.values()) if (!live.has(row.id) && row.endTime === undefined) row.endTime = Date.now();
  }

  function write(force = false): void {
    // A process that never had children stays silent: no file, no noise.
    if (!force && rows.size === 0 && !lastWritten) return;
    const body = JSON.stringify({ pid: process.pid, label, sessionFile, agents: [...rows.values()] });
    if (body === lastWritten) return;
    try {
      fs.mkdirSync(STATE_DIR, { recursive: true });
      fs.writeFileSync(`${stateFile}.tmp`, body);
      fs.renameSync(`${stateFile}.tmp`, stateFile);
      lastWritten = body;
    } catch {}
  }

  function closePane(): void {
    if (!paneId) return;
    try { closeHerdrPane(paneId); } catch {}
    paneId = undefined;
  }

  pi.on("session_start", (_event, ctx) => {
    const file = ctx.sessionManager.getSessionFile();
    sessionFile = file ? path.resolve(file) : undefined;
    label = ctx.sessionManager.getSessionName() || "main";
    timer ??= setInterval(() => { poll(); write(); }, 500);
  });

  pi.registerCommand("agents", {
    description: "Toggle a split on the right with a live graph of this session's subagents; /agents clear forgets finished ones",
    handler: async (args, ctx: ExtensionContext) => {
      if (args.trim() === "clear") {
        for (const [id, row] of rows) if (row.endTime !== undefined) rows.delete(id);
        write();
        return;
      }
      if (paneId) return closePane();
      if (process.env.HERDR_ENV !== "1" || !process.env.HERDR_PANE_ID) {
        ctx.ui.notify(`The agents graph needs a Herdr pane. Elsewhere, run: node ${VIEWER} ${process.pid}`, "warning");
        return;
      }
      // Write the root even with no children yet, so the viewer has a node to draw.
      poll();
      lastWritten = "";
      write(true);
      try {
        const pane = splitHerdrPane({ paneId: process.env.HERDR_PANE_ID, direction: "right", cwd: ctx.cwd, focus: false });
        paneId = pane.paneId;
        try { renameHerdrPane(pane.paneId, "agents"); } catch {}
        runHerdrPaneCommand(pane.paneId, `exec ${shellArgument(process.execPath)} ${shellArgument(VIEWER)} ${process.pid}`);
      } catch (error) {
        closePane();
        ctx.ui.notify(`Could not open the agents graph: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });

  pi.on("session_shutdown", (event) => {
    // pi-subagents raises a reason-less shutdown to stop a coordinator turn
    // while children run on; only a real shutdown ends the view.
    if (!event.reason) return;
    if (timer) clearInterval(timer);
    timer = undefined;
    closePane();
    try { fs.rmSync(stateFile, { force: true }); } catch {}
  });
}
