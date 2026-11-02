import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Tells Herdr pi is blocked while the agent waits on you in a prompt: a
 * pi-question-tool question, a confirm/select/input dialog, and the like.
 *
 * herdr-agent-state.ts (managed by Herdr, overwritten on updates) already
 * reports "blocked" on `herdr:blocked` events but nothing in pi sends them;
 * this sends them from pi's ui_prompt_start/end events.
 *
 * Only prompts that open while the agent is running count: a dialog you open
 * yourself at an idle prompt (/subagents, Alt+S) is not the agent asking.
 */
export default function (pi: ExtensionAPI) {
  let running = false;
  let blocked = false;

  function release(): void {
    if (!blocked) return;
    blocked = false;
    pi.events.emit("herdr:blocked", { active: false });
  }

  pi.on("agent_start", () => { running = true; });
  pi.on("agent_settled", (_event, ctx) => {
    if (ctx.isIdle()) running = false;
  });

  pi.on("ui_prompt_start", (event) => {
    if (!running || blocked) return;
    blocked = true;
    pi.events.emit("herdr:blocked", { active: true, label: event.title ?? "Waiting for your answer" });
  });
  pi.on("ui_prompt_end", () => release());
  pi.on("session_shutdown", () => release());
}
