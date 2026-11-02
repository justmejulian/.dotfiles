// slack-fetch <slack link> [question] [--json]
import { fetchSlack, formatSlack } from "./slack.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const [link, ...question] = args.filter((a) => a !== "--json");
if (!link) {
  console.error("usage: slack-fetch <slack message link> [question] [--json]");
  process.exit(2);
}
const result = await fetchSlack(link, { question: question.join(" ") || undefined });
console.log(json ? JSON.stringify(result, null, 2) : formatSlack(result));
