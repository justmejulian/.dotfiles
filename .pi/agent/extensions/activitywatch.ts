// ActivityWatch companion to Herdr's managed integration. Kept separate so
// Herdr updates do not overwrite it. Loaded globally by Pi from ~/.pi/agent/extensions.
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let current: Record<string, string> | undefined;
  let active = false;
  let prompts = 0;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let pending = Promise.resolve();
  let queued = 0;

  function snapshot(ctx: ExtensionContext) {
    return {
      session_id: ctx.sessionManager.getSessionId(),
      cwd: ctx.cwd,
      model: ctx.model?.id ?? "",
      title: ctx.sessionManager.getSessionName() ?? "",
    };
  }

  function report(event: string, data = current, extra: Record<string, string> = {}) {
    if (!data?.session_id) return pending;
    const payload = JSON.stringify({ ...data, ...extra, hook_event_name: event });
    queued++;
    // Preserve ordering when tools or prompts finish together. No shell, output,
    // or propagated errors; an unavailable watcher must not break Pi.
    pending = pending.then(() => new Promise<void>((resolve) => {
      const child = spawn(path.join(homedir(), ".local/bin/aw-hook"), ["pi"], {
        stdio: ["pipe", "ignore", "ignore"], timeout: 2500,
      });
      child.on("error", () => resolve());
      child.on("close", () => resolve());
      child.stdin.on("error", () => {});
      child.stdin.end(payload);
    })).catch(() => {}).finally(() => { queued--; });
    return pending;
  }

  function status() {
    return prompts > 0 ? "PermissionRequest" : active ? "PostToolUse" : "Stop";
  }

  pi.on("session_start", async (_event, ctx) => {
    if (heartbeat) clearInterval(heartbeat);
    const next = snapshot(ctx);
    if (current && current.session_id !== next.session_id) await report("SessionEnd");
    current = next;
    active = !ctx.isIdle();
    prompts = 0;
    await report(active ? "PostToolUse" : "SessionStart");
    // Long model calls and long-running tools should remain visible, including
    // while AFK; they otherwise have no hook until they finish.
    heartbeat = setInterval(() => {
      if (queued === 0) void report(status());
    }, 30_000);
    heartbeat.unref();
  });

  pi.on("before_agent_start", async (event, ctx) => {
    current = snapshot(ctx);
    active = true;
    await report("UserPromptSubmit", current, { prompt: event.messageType === "user" ? event.prompt : "" });
  });
  pi.on("agent_start", async (_event, ctx) => {
    current = snapshot(ctx);
    active = true;
    await report(status());
  });
  pi.on("tool_execution_end", async (_event, ctx) => {
    current = snapshot(ctx);
    await report(status());
  });
  pi.on("ui_prompt_start", async (_event, ctx) => {
    current = snapshot(ctx);
    prompts++;
    await report(status());
  });
  pi.on("ui_prompt_end", async (_event, ctx) => {
    current = snapshot(ctx);
    prompts = Math.max(0, prompts - 1);
    await report(status());
  });
  pi.on("agent_settled", async (_event, ctx) => {
    current = snapshot(ctx);
    active = false;
    await report(status());
  });
  pi.on("session_info_changed", async (_event, ctx) => {
    current = snapshot(ctx);
    await report(status());
  });
  pi.on("model_select", async (_event, ctx) => {
    current = snapshot(ctx);
    await report(status());
  });
  pi.on("session_shutdown", async () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    await report("SessionEnd");
    current = undefined;
  });
}
