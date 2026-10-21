// Fetch a Slack message or thread from a link with headless Claude (the
// claude.ai Slack connector, read-only). Used by bin/slack-fetch, the pi
// /slack command and slack_fetch tool (~/.pi/agent/extensions/slack.ts), and
// the develop workflow's intake.
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { runClaude } from "./claude.ts";

export type SlackMessage = { author: string; time: string; text: string };
export type SlackFetch = {
  kind: "message" | "thread";
  channel: string;
  permalink: string;
  messages: SlackMessage[];
  summary: string;
  /** Answer to the question, from the messages only; "" without a question. */
  answer: string;
};

const str = { type: "string" };
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "channel", "permalink", "messages", "summary", "answer"],
  properties: {
    kind: { type: "string", enum: ["message", "thread"] },
    channel: str,
    permalink: str,
    messages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["author", "time", "text"],
        properties: { author: str, time: str, text: str },
      },
    },
    summary: str,
    answer: str,
  },
};

export const slackLink = /https:\/\/[\w-]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d{16}(?:\?[^\s)>\]]*)?/g;

/** Slack message links in text, without duplicates. */
export function slackLinks(text: string): string[] {
  return [...new Set(text.match(slackLink) ?? [])];
}

/** Run folder for fetches outside a workflow run, so run-stats counts them. */
function adHocRunDir() {
  const dir = path.join(os.homedir(), ".pi/agent/workflows/runs/_slack", new Date().toISOString().slice(0, 10));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function fetchSlack(link: string, options: { question?: string; runDir?: string; cwd?: string; signal?: AbortSignal } = {}) {
  const result = await runClaude<SlackFetch>({
    role: "slack",
    signal: options.signal,
    cwd: options.cwd ?? os.homedir(),
    runDir: options.runDir ?? adHocRunDir(),
    schema,
    timeoutMs: 5 * 60_000,
    prompt: `Read this Slack link with the Slack tools: ${link}

- If the message is in a thread, or has replies, read the whole thread (kind "thread"). Otherwise return just that message (kind "message").
- Give each message's author as a name (look up user ids with the profile tool, once per person), its time, and its text verbatim, keeping links. Oldest first.
- channel: the channel name without "#" (look it up; not the channel id). permalink: the link above.
- summary: 2 to 4 sentences on what was said and decided.
- answer: ${options.question ? `answer this from the messages only (say so if they don't cover it): ${options.question}` : `"" (no question was asked).`}`,
  });
  return result.output;
}

/** Markdown for people and for the model. */
export function formatSlack(fetch: SlackFetch): string {
  return [
    `Slack ${fetch.kind} in #${fetch.channel.replace(/^#/, "")}: ${fetch.permalink}`,
    "",
    fetch.answer ? `Answer: ${fetch.answer}\n` : "",
    `Summary: ${fetch.summary}`,
    "",
    ...fetch.messages.map((m) => `- ${m.author} (${m.time}): ${m.text}`),
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
}
