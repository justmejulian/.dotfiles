import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const stateType = "orchestration-mode";
const instructionFile = path.join(os.homedir(), ".pi/agent/modes/orchestration.md");
const isManagedChild = (): boolean => Boolean(process.env.PI_SUBAGENT_AGENT || process.env.PI_SUBAGENT_SESSION);

export default function orchestration(pi: ExtensionAPI): void {
  let enabled = false;

  pi.registerFlag("orchestrator", {
    description: "Add orchestration guidance without changing normal tools or skills",
    type: "boolean",
    default: false,
  });

  function display(ctx: ExtensionContext): void {
    if (ctx.hasUI) ctx.ui.setStatus(stateType, enabled ? "orchestration" : undefined);
  }

  pi.on("session_start", (event, ctx) => {
    const entry = ctx.sessionManager.getBranch().findLast(entry => entry.type === "custom" && entry.customType === stateType);
    const saved = entry?.type === "custom" && (entry.data as { enabled?: unknown } | undefined)?.enabled === true;
    enabled = !isManagedChild() && (saved || (pi.getFlag("orchestrator") === true && event.reason !== "reload"));
    if (enabled !== saved) pi.appendEntry(stateType, { enabled });
    display(ctx);
  });

  pi.registerCommand("orchestration", {
    description: "Enable orchestration guidance; /orchestration off disables it; status shows the current mode",
    handler: async (args, ctx) => {
      if (isManagedChild()) {
        ctx.ui.notify("Orchestration mode belongs to the main session; this subagent keeps its assigned role.", "warning");
        return;
      }
      const command = args.trim().toLowerCase() || "on";
      if (!["on", "off", "status"].includes(command)) {
        ctx.ui.notify("Use /orchestration [on|off|status].", "warning");
        return;
      }
      if (command !== "status") {
        enabled = command === "on";
        pi.appendEntry(stateType, { enabled });
        display(ctx);
      }
      ctx.ui.notify(`Orchestration guidance is ${enabled ? "on" : "off"}. Tools and skills are unchanged.`, "info");
    },
  });

  pi.on("before_agent_start", event => {
    if (enabled && !isManagedChild()) {
      event.systemPromptOptions.sections.orchestration = fs.readFileSync(instructionFile, "utf8").trim();
    } else {
      delete event.systemPromptOptions.sections.orchestration;
    }
  });
}
