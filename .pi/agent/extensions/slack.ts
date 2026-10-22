// Slack messages and threads from a link, via headless Claude (read-only;
// ~/.pi/agent/workflows/lib/slack.ts):
//   - tool slack_fetch: pi reads a Slack link it comes across, optionally
//     answering a question from it
//   - /slack <link> [question]: show it in the chat
import { Type } from "typebox";
import { fetchSlack, formatSlack } from "../workflows/lib/slack.ts";

export default function (pi) {
  pi.registerTool({
    name: "slack_fetch",
    label: "Slack",
    description:
      "Read a Slack message or thread from its link (https://<workspace>.slack.com/archives/...). Returns the messages with authors and times, a short summary, and an answer to `question` if given. Read-only.",
    parameters: Type.Object({
      link: Type.String({ description: "Slack message link" }),
      question: Type.Optional(Type.String({ description: "What to find out from the messages" })),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      const result = await fetchSlack(params.link, { question: params.question, cwd: ctx?.cwd, signal });
      return { content: [{ type: "text", text: formatSlack(result) }], details: result };
    },
  });

  pi.registerCommand("slack", {
    description: "Show a Slack message or thread: /slack <link> [question]",
    handler: async (args, ctx) => {
      const [link, ...question] = (args ?? "").trim().split(/\s+/);
      if (!link) {
        // Picking /slack from autocomplete submits it at once: put it back in
        // the input so I can paste the link.
        ctx.ui.pasteToEditor("/slack ");
        return;
      }
      ctx.ui.notify("Fetching from Slack…", "info");
      try {
        const result = await fetchSlack(link, { question: question.join(" ") || undefined, cwd: ctx.cwd });
        pi.sendMessage({ customType: "slack-fetch", content: formatSlack(result), display: true });
      } catch (error) {
        ctx.ui.notify(`Slack fetch failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });
}
