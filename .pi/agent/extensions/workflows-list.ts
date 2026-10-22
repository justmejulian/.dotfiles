// /workflows: list and start workflows without fighting autocomplete.
//
//   /workflows <Tab>        every workflow with a one-line description;
//                           user-facing first, JSON-input stages last
//   /workflows develop      puts "/workflow develop " in the input to add the task
//   /workflows develop <x>  starts it right away
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Pipeline stages that only take structured JSON from another workflow. */
const JSON_ONLY = new Set(["implement", "review", "refine", "publish"]);
/** User-facing workflows that run without any input. */
const NO_INPUT = new Set(["address-feedback"]);

type Workflow = { name: string; description: string; jsonOnly: boolean };

function workflowDirs() {
  return [path.join(process.cwd(), ".pi/workflows"), path.join(os.homedir(), ".pi/agent/workflows")];
}

/** First sentence of the file's header comment, skipping usage lines. */
function describe(file: string) {
  const header: string[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n").slice(0, 20)) {
    if (!line.startsWith("//")) break;
    const text = line.replace(/^\/\/\s?/, "").trim();
    if (text.startsWith("/workflow")) continue;
    if (!text && header.length) break; // end of the first paragraph
    if (text) header.push(text);
  }
  const paragraph = header.join(" ");
  return (paragraph.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? paragraph).slice(0, 110);
}

function listWorkflows(): Workflow[] {
  const seen = new Map<string, Workflow>();
  for (const dir of workflowDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      const name = entry.match(/^(.+)\.workflow\.(ts|mts|js|mjs)$/)?.[1];
      if (!name || seen.has(name)) continue; // project workflows win
      const jsonOnly = JSON_ONLY.has(name) || name.startsWith("stage-");
      seen.set(name, { name, description: describe(path.join(dir, entry)), jsonOnly });
    }
  }
  return [...seen.values()].sort((a, b) => Number(a.jsonOnly) - Number(b.jsonOnly) || a.name.localeCompare(b.name));
}

export default function (pi) {
  pi.registerCommand("workflows", {
    description: "List workflows (Tab) and start one: /workflows <name> [task]",
    getArgumentCompletions: (prefix: string) => {
      if (prefix.includes(" ")) return null; // past the workflow name
      return listWorkflows()
        .filter((w) => w.name.startsWith(prefix))
        .map((w) => ({
          value: w.name,
          label: w.name,
          description: `${w.jsonOnly ? "(JSON input) " : ""}${w.description}`,
        }));
    },
    handler: async (args, ctx) => {
      const [name, ...rest] = (args ?? "").trim().split(/\s+/).filter(Boolean);
      if (!name) {
        // Picking /workflows from autocomplete submits it at once.
        ctx.ui.pasteToEditor("/workflows ");
        return;
      }
      const workflow = listWorkflows().find((w) => w.name === name);
      if (!workflow) {
        ctx.ui.notify(`No workflow named "${name}". Press Tab after /workflows to list them.`, "warning");
        return;
      }
      if (rest.length) {
        pi.sendUserMessage(`/workflow ${name} ${rest.join(" ")}`);
      } else if (NO_INPUT.has(name)) {
        pi.sendUserMessage(`/workflow ${name}`);
      } else {
        ctx.ui.pasteToEditor(workflow.jsonOnly ? `/workflow ${name} --input-json ` : `/workflow ${name} `);
      }
    },
  });
}
