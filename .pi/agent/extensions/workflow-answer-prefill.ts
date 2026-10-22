// Answer pi-workflows protected decisions from a picker instead of typing
// `/workflow answer <id> {"choice":...,"input":{...}}`.
//
// When a decision appears, pick a choice from a list; choices that take text
// ask for it next. The finished answer command is then left in the input, so
// one Enter sends it.
// Esc leaves `/workflow answer <id> ` in the input; /decide reopens the picker
// for the latest pending decision.
//
// pi-workflows adds the decision with pi.sendMessage while pi is idle, which
// emits no message events, so the session's latest entries are polled. The
// choice contracts (labels, text field names) come from pi-workflows' state
// database, read-only.
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const TYPE = "pi-workflows-interaction";
const DB = path.join(os.homedir(), ".pi/agent/workflows/state.sqlite");

type Choice = { label: string; input?: { name: string; prompt: string; minLength: number; maxLength: number } };
type Decision = { id: string; title: string };

function query(sql: string): string {
  return execFileSync("sqlite3", ["-readonly", `file:${DB}?mode=ro`, sql], { encoding: "utf8" }).trim();
}

function choicesOf(id: string): Record<string, Choice> | null {
  if (!/^decision-[0-9a-f]+$/.test(id)) return null;
  const json = query(
    `select cast(b.content as text) from human_decisions h join blobs b on b.blob_hash = h.choices_hash where h.decision_id = '${id}';`,
  );
  return json ? JSON.parse(json) : null;
}

function resolved(id: string): boolean {
  return query(`select count(*) from human_decision_resolutions where decision_id = '${id}';`) !== "0";
}

/** Decision messages on the current branch, oldest first. */
function decisions(ctx): (Decision & { entryId: string })[] {
  return ctx.sessionManager
    .getBranch()
    .filter((entry) => entry.type === "custom_message" && entry.customType === TYPE)
    .map((entry) => {
      const text = typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content);
      const id = entry.details?.requestId ?? text.match(/\/workflow answer (decision-[0-9a-f]+)/)?.[1];
      const title = text.split("\n").find((line) => line.trim() && !line.startsWith("[")) ?? "Workflow decision";
      return id?.startsWith("decision-") ? { id, title: title.trim(), entryId: entry.id } : null;
    })
    .filter(Boolean);
}

export default function (pi) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let asking = false;

  async function ask(ctx, decision: Decision) {
    if (asking) return;
    asking = true;
    try {
      const choices = choicesOf(decision.id);
      if (!choices || resolved(decision.id)) return;
      const ids = Object.keys(choices);
      const labels = ids.map((id) => choices[id].label + (choices[id].input ? " …" : ""));
      const picked = await ctx.ui.select(decision.title, labels);
      const choice = ids[labels.indexOf(picked)];
      if (!choice) {
        ctx.ui.pasteToEditor(`/workflow answer ${decision.id} `);
        ctx.ui.notify("Decision still open. /decide reopens it.", "info");
        return;
      }
      const response: { choice: string; input?: Record<string, string> } = { choice };
      const input = choices[choice].input;
      if (input) {
        const text = (await ctx.ui.input(`${choices[choice].label}: ${input.prompt}`, "Type and press Enter"))?.trim();
        if (!text) {
          ctx.ui.notify("No text given; decision still open. /decide reopens it.", "warning");
          return;
        }
        response.input = { [input.name]: text.slice(0, input.maxLength) };
      }
      // Extensions can't run commands (sendUserMessage goes to the model), so
      // leave the finished command in the input for one Enter.
      ctx.ui.setEditorText("");
      ctx.ui.pasteToEditor(`/workflow answer ${decision.id} ${JSON.stringify(response)}`);
      ctx.ui.notify("Press Enter to send your answer.", "info");
    } catch (error) {
      ctx.ui.notify(`Couldn't open the decision picker: ${error instanceof Error ? error.message : error}`, "error");
    } finally {
      asking = false;
    }
  }

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    clearInterval(timer);
    const seen = new Set(decisions(ctx).map((d) => d.entryId)); // already there at start
    timer = setInterval(() => {
      for (const decision of decisions(ctx)) {
        if (seen.has(decision.entryId)) continue;
        seen.add(decision.entryId);
        void ask(ctx, decision);
      }
    }, 2000);
  });

  pi.on("session_shutdown", () => clearInterval(timer));

  pi.registerCommand("decide", {
    description: "Answer the latest pending workflow decision from a picker",
    handler: async (_args, ctx) => {
      const pending = decisions(ctx).filter((d) => !resolved(d.id)).at(-1);
      if (!pending) {
        ctx.ui.notify("No pending workflow decision in this session.", "info");
        return;
      }
      await ask(ctx, pending);
    },
  });
}
