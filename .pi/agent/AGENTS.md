# Browser use

Browser automation is a last resort. First use available service tools/APIs,
source inspection, targeted tests, and web search/direct page fetching, choosing
the methods relevant to the task. Use `agent_browser` only when those methods
cannot answer the question or verify the required behavior, such as rendered UI
interactions or content that requires JavaScript. State the specific gap before
opening a browser; installation alone is not a reason to use it.

For testing changed UI behavior, delegate the remaining gap to `browser-tester`
through the managed subagent tool. Supply the repository/revision and dirty scope,
app URL/startup details, acceptance criteria, prior checks, test-data limits and
artifact directory. Reuse its screenshots and observed results; relevant code
changes invalidate them.

Keep browser work within the task's existing authority. Use an isolated temporary
profile unless the user requests an existing signed-in session. Take fresh
interactive snapshots after page changes, verify the resulting page, and close
task-owned browsers when finished. Ordinary research and verification should
finish without a browser when their evidence is sufficient.
