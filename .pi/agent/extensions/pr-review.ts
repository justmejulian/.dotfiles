// Open the herdr "PR review" tab (~/.config/herdr/local-plugins/pr-review)
// when pi creates a pull request, and add /pr-review [number|url] for existing
// PRs. Only active inside herdr, where HERDR_PANE_ID identifies this pi pane
// so the watchers know where to send feedback.
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const openScript = path.join(os.homedir(), ".config/herdr/local-plugins/pr-review/open.sh");
const prUrl = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/;

export default function (pi) {
  const pane = process.env.HERDR_PANE_ID;
  if (process.env.HERDR_ENV !== "1" || !pane) {
    return;
  }

  function openTab(cwd: string, ref: string) {
    spawn("bash", [openScript, cwd, ref, pane], { detached: true, stdio: "ignore" }).unref();
  }

  pi.on("tool_result", (event, ctx) => {
    if (event.toolName !== "bash" || event.isError) {
      return;
    }
    if (!/\bgh\s+pr\s+create\b/.test(String(event.input?.command ?? ""))) {
      return;
    }
    const output = event.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    const url = output.match(prUrl)?.[0];
    if (url) {
      openTab(ctx.cwd, url);
    }
  });

  pi.registerCommand("pr-review", {
    description: "Open the herdr PR review tab (default: this branch's PR)",
    handler: async (args, ctx) => {
      openTab(ctx.cwd, (args ?? "").trim());
      ctx.ui.notify("Opening the PR review tab", "info");
    },
  });
}
