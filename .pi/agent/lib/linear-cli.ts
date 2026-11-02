import { fetchLinear, formatLinear } from "./linear.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const [issue, ...question] = args.filter((arg) => arg !== "--json");
if (!issue) {
  console.error("usage: linear-fetch <Linear issue URL or identifier> [question] [--json]");
  process.exit(2);
}
async function main(): Promise<void> {
  try {
    const result = await fetchLinear(issue, { question: question.join(" ") || undefined });
    console.log(json ? JSON.stringify(result, null, 2) : formatLinear(result));
  } catch (error) {
    console.error(`Linear fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

void main();
