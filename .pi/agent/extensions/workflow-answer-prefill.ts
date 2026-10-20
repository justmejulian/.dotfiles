// When pi-workflows shows a protected decision ("A human must answer this
// protected decision with /workflow answer <id> <response>"), prefill pi's
// input with `/workflow answer <id> ` so I only type the choice.
//
// pi-workflows adds the decision with pi.sendMessage while pi is idle, which
// emits no message events, so check the session's latest entries instead.
const TYPE = "pi-workflows-interaction";

export default function (pi) {
  let timer: ReturnType<typeof setInterval> | undefined;

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    clearInterval(timer);
    const seen = new Set<string>();
    let first = true;
    timer = setInterval(() => {
      const recent = ctx.sessionManager.getBranch().slice(-20);
      for (const entry of recent) {
        if (entry.type !== "custom_message" || entry.customType !== TYPE || seen.has(entry.id)) continue;
        seen.add(entry.id);
        if (first) continue; // already there when pi started
        const text = typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content);
        const id = text.match(/\/workflow answer (decision-[0-9a-f]+)/)?.[1];
        if (id && !ctx.ui.getEditorText().trim()) ctx.ui.pasteToEditor(`/workflow answer ${id} `);
      }
      first = false;
    }, 2000);
  });

  pi.on("session_shutdown", () => clearInterval(timer));
}
