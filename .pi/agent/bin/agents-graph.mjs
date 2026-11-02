#!/usr/bin/env node
// Live tree of a pi session's subagents, drawn in the split /agents opens.
// Click an agent (or ↑↓ + Enter) to follow its session; Esc goes back.
// In a session, click a ▸ block to expand it; e expands or collapses all;
// i (or clicking the header) shows the agent's model, usage and launch settings.
//
// Usage: agents-graph.mjs <root pi pid>
//
// Reads the snapshots agents-view.ts writes to ~/.pi/agent/agents-view/<pid>.json
// and hangs each child's own snapshot (matched by session file) beneath it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STATE_DIR = path.join(os.homedir(), ".pi/agent/agents-view");
const rootPid = Number(process.argv[2]);
const SPINNER = ["◜", "◠", "◝", "◞", "◡", "◟"];
const C = { dim: 2, bold: 1, inverse: 7, accent: 36, green: 32, red: 31, muted: 37, yellow: 33, blue: 34, magenta: 35 };
const TAIL_BYTES = 512 * 1024;

if (!rootPid) {
  console.error("usage: agents-graph.mjs <pi pid>");
  process.exit(1);
}

const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };

// Last snapshot seen per session file: a nested child's subtree outlives its
// process, so finished agents keep their children in the graph.
const bySession = new Map();
let root = null;

function load() {
  let names = [];
  try { names = fs.readdirSync(STATE_DIR).filter(n => n.endsWith(".json")); } catch {}
  for (const name of names) {
    const file = path.join(STATE_DIR, name);
    let snap;
    try { snap = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    if (!alive(snap.pid)) { try { fs.rmSync(file, { force: true }); } catch {} }
    if (snap.sessionFile) bySession.set(snap.sessionFile, snap);
    if (snap.pid === rootPid) root = snap;
  }
}

const elapsed = ms => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
};

// A line is a list of [text, ...sgr codes]; cut to width before painting.
function paint(segments, width) {
  let left = width, out = "";
  for (const [text, ...codes] of segments) {
    if (left <= 0) break;
    const cut = [...text].slice(0, left).join("");
    left -= [...cut].length;
    out += codes.length ? `\x1b[${codes.join(";")}m${cut}\x1b[0m` : cut;
  }
  return out;
}

function wrap(text, width) {
  const out = [];
  for (const raw of text.split("\n")) {
    const chars = [...raw];
    if (chars.length === 0) { out.push(""); continue; }
    // Break at the last space that fits; hard-cut a word longer than a line.
    let i = 0;
    while (chars.length - i > width) {
      let cut = chars.lastIndexOf(" ", i + width);
      if (cut <= i) cut = i + width;
      out.push(chars.slice(i, cut).join(""));
      i = chars[cut] === " " ? cut + 1 : cut;
    }
    out.push(chars.slice(i).join(""));
  }
  return out;
}

// ---------- graph ----------

function counts(agents, seen = new Set()) {
  let running = 0, done = 0;
  for (const a of agents) {
    a.endTime === undefined ? running++ : done++;
    const child = bySession.get(a.sessionFile);
    if (child && !seen.has(a.sessionFile)) {
      seen.add(a.sessionFile);
      const c = counts(child.agents, seen);
      running += c.running; done += c.done;
    }
  }
  return { running, done };
}

// Each line carries `target` when clicking it should open an agent.
function tree(agents, prefix, lines, seen) {
  agents.forEach((a, i) => {
    const last = i === agents.length - 1;
    const done = a.endTime !== undefined;
    const icon = done ? ["✓", C.green] : [SPINNER[frame % SPINNER.length], C.accent];
    const type = a.agent && a.agent !== a.name ? [` ${a.agent}`, C.dim] : ["", C.dim];
    const tools = a.toolUses ? `  ${a.toolUses} tool${a.toolUses === 1 ? "" : "s"}` : "";
    const target = { sessionFile: a.sessionFile, name: a.name, agent: a };
    lines.push({ target, segments: [
      [prefix + (last ? "└─ " : "├─ "), C.dim], icon, [" "],
      [a.name, ...(done ? [C.muted] : [C.bold])], type,
      [`  ${elapsed((a.endTime ?? Date.now()) - a.startTime)}${tools}`, C.dim],
    ] });
    const inner = prefix + (last ? "   " : "│  ");
    const detail = done ? a.title : a.activity || a.title;
    if (detail) lines.push({ target, segments: [[inner + "  ", C.dim], [detail, ...(done ? [C.dim] : [C.muted])]] });
    const child = bySession.get(a.sessionFile);
    if (child?.agents.length && !seen.has(a.sessionFile)) {
      seen.add(a.sessionFile);
      tree(child.agents, inner, lines, seen);
    }
  });
}

function graphLines() {
  if (!root) return [{ segments: [[`waiting for pi ${rootPid}…`, C.dim]] }];
  const { running, done } = counts(root.agents);
  const lines = [{
    target: root.sessionFile ? { sessionFile: root.sessionFile, name: root.label || "main" } : undefined,
    segments: [["◆ ", C.accent], [root.label || "main", C.bold, C.accent], [`  ${running} running · ${done} done`, C.dim]],
  }];
  if (!alive(rootPid)) lines.push({ segments: [["  session ended", C.yellow]] });
  lines.push({ segments: [["│", C.dim]] });
  if (root.agents.length === 0) lines.push({ segments: [["└─ no subagents yet", C.dim]] });
  tree(root.agents, "", lines, new Set());
  return lines;
}

// ---------- detail: one agent's session, tailed ----------

function summarizeArgs(name, args = {}) {
  const v = args.command ?? args.path ?? args.pattern ?? args.query ?? args.url ?? args.agent ?? args.task;
  if (typeof v === "string") return v.split("\n")[0];
  const json = JSON.stringify(args);
  return json === "{}" ? "" : json;
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter(p => p.type === "text").map(p => p.text).join("\n");
}

// Blocks the user clicked open (or shut, while `e` has everything open),
// keyed by session entry id and part index.
const toggled = new Set();
let expandAll = false;
const isOpen = key => expandAll !== toggled.has(key);

// The feed as { segments, key } lines, oldest first, wrapped to width.
// Lines of a block that can expand carry its key, so a click toggles it.
function sessionFeed(file, width) {
  let buf = "";
  try {
    const fd = fs.openSync(file, "r");
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - TAIL_BYTES);
    const b = Buffer.alloc(size - start);
    fs.readSync(fd, b, 0, b.length, start);
    fs.closeSync(fd);
    buf = b.toString("utf8");
    if (start > 0) buf = buf.slice(buf.indexOf("\n") + 1);
  } catch (e) {
    return [{ segments: [[`cannot read ${file}: ${e.code ?? e.message}`, C.red]] }];
  }
  const out = [];
  const blank = () => out.push({ segments: [[""]] });
  // Text under a prefix, cut to `max` lines unless its block is open.
  const push = (prefix, text, codes, max = Infinity, key) => {
    const pad = " ".repeat([...prefix].length);
    const lines = wrap(text.replace(/\s+$/, "").replace(/^\n+/, ""), Math.max(10, width - pad.length));
    const long = lines.length > max;
    const open = long && isOpen(key);
    const shown = long && !open ? lines.slice(0, max) : lines;
    shown.forEach((l, i) => out.push({ key: long ? key : undefined, segments: [[i === 0 ? prefix : pad, ...codes], [l, ...codes]] }));
    if (long) out.push({ key, segments: [[pad, C.dim], [open ? "▴ collapse" : `▸ ${lines.length - max} more lines`, C.dim, C.accent]] });
  };
  for (const line of buf.split("\n")) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const m = e.type === "message" ? e.message : null;
    if (!m) continue;
    const id = e.id ?? e.timestamp;
    if (m.role === "user") {
      const t = textOf(m.content);
      if (t.trim()) { blank(); push("› ", t, [C.blue], 12, `${id}`); }
    } else if (m.role === "assistant" && Array.isArray(m.content)) {
      m.content.forEach((p, i) => {
        const key = `${id}:${i}`;
        if (p.type === "text" && p.text.trim()) { blank(); push("", p.text, []); }
        else if (p.type === "thinking" && (p.thinking ?? "").trim()) push("∴ ", p.thinking, [C.dim], 3, key);
        else if (p.type === "toolCall") {
          const summary = summarizeArgs(p.name, p.arguments);
          const full = typeof p.arguments === "object" && p.arguments
            ? Object.entries(p.arguments).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v, null, 2)}`).join("\n")
            : "";
          const more = full && full !== summary;
          if (more && isOpen(key)) {
            const from = out.length;
            out.push({ segments: [["▴ ", C.magenta], [p.name, C.bold, C.magenta]] });
            push("    ", full, [C.muted]);
            for (let j = from; j < out.length; j++) out[j].key = key;
          } else {
            out.push({ key: more ? key : undefined, segments: [[more ? "▸ " : "· ", C.magenta], [p.name, C.bold, C.magenta], [" " + summary, C.muted]] });
          }
        }
      });
      if (m.stopReason === "error" && m.errorMessage) push("✗ ", m.errorMessage, [C.red], 4, `${id}:err`);
    } else if (m.role === "toolResult") {
      const t = textOf(m.content);
      const n = t ? t.split("\n").length : 0;
      if (m.isError) push("  ✗ ", t || "error", [C.red], 4, `${id}`);
      else if (n && isOpen(`${id}`)) {
        const from = out.length;
        push("  │ ", t, [C.dim]);
        out.push({ segments: [["  ▴ collapse", C.dim, C.accent]] });
        for (let j = from; j < out.length; j++) {
          out[j].key = `${id}`;
          if (j < out.length - 1) out[j].segments[0] = ["  │ ", C.dim];
        }
      } else {
        out.push({ key: n ? `${id}` : undefined, segments: [[`  ${n ? "▸" : "↳"} ${n} line${n === 1 ? "" : "s"}`, C.dim], [n ? `  ${t.split("\n").find(l => l.trim())?.trim() ?? ""}` : "", C.dim]] });
      }
    }
  }
  return out;
}

// ---------- info: what an agent was launched with and has spent ----------

// Whole-file scan, cached by size: the launch metadata sits at the top and
// usage accrues per turn, so neither the tail nor the snapshot has it all.
const infoCache = new Map();
function sessionInfo(file) {
  let size = -1;
  try { size = fs.statSync(file).size; } catch {}
  const hit = infoCache.get(file);
  if (hit && hit.size === size) return hit.info;
  const info = { launch: null, header: null, model: null, thinking: null, turns: 0, input: 0, output: 0, cacheRead: 0, cost: 0, context: 0, task: "" };
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch {}
  for (const line of text.split("\n")) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === "session") info.header = e;
    else if (e.type === "custom" && e.customType === "pi-subagents_launch_metadata") info.launch = e.data;
    else if (e.type === "model_change") info.model = `${e.provider}/${e.modelId}`;
    else if (e.type === "thinking_level_change") info.thinking = e.thinkingLevel ?? info.thinking;
    else if (e.type === "message" && e.message?.role === "user" && !info.task) info.task = textOf(e.message.content);
    else if (e.type === "message" && e.message?.role === "assistant") {
      const m = e.message, u = m.usage ?? {};
      info.turns++;
      info.model = `${m.provider}/${m.model}`;
      if (m.thinkingLevel) info.thinking = m.thinkingLevel;
      info.input += u.input ?? 0; info.output += u.output ?? 0; info.cacheRead += u.cacheRead ?? 0;
      info.cost += u.cost?.total ?? 0;
      if (u.totalTokens) info.context = u.totalTokens;
    }
  }
  infoCache.set(file, { size, info });
  return info;
}

const tokens = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
const clock = ms => new Date(ms).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function infoLines(width) {
  const a = opened.agent ?? {};
  const i = sessionInfo(opened.sessionFile);
  const l = i.launch ?? {};
  const out = [];
  const section = title => { out.push([[""]]); out.push([[title, C.bold, C.accent]]); };
  const row = (label, value, ...codes) => {
    if (value === undefined || value === null || value === "") return;
    const pad = 16;
    wrap(String(value), Math.max(10, width - pad)).forEach((v, n) =>
      out.push([[n ? " ".repeat(pad) : `  ${label}`.padEnd(pad), C.dim], [v, ...codes]]));
  };
  const live = opened.agent ? a.endTime === undefined : alive(rootPid);

  section("Agent");
  row("name", a.name ?? l.name ?? opened.name, C.bold);
  row("type", a.agent ?? l.agent);
  row("title", a.title ?? l.title);
  row("status", live ? "running" : "done", live ? C.accent : C.green);
  if (live && a.activity) row("doing", a.activity, C.muted);
  row("id", a.id);

  section("Model");
  const launched = l.modelRef ?? a.model;
  row("model", i.model ?? l.model ?? a.model, C.bold);
  row("thinking", i.thinking ?? l.thinking);
  if (launched) row("launched as", launched + (l.modelSource ? `  (from ${l.modelSource})` : ""));
  if (l.definitionModel && l.definitionModel !== l.model) row("definition", l.definitionModel);

  section("Usage");
  if (a.startTime) row("started", clock(a.startTime));
  if (a.endTime) row("ended", clock(a.endTime));
  if (a.startTime) row("elapsed", elapsed((a.endTime ?? Date.now()) - a.startTime));
  row("turns", i.turns);
  row("tool uses", a.toolUses);
  row("tokens", `${tokens(i.input)} in · ${tokens(i.output)} out · ${tokens(i.cacheRead)} cached`);
  if (i.context) row("context", `${tokens(i.context)} at last turn`);
  if (i.cost) row("cost", `$${i.cost.toFixed(2)}`);

  section("Launch");
  row("tools", l.tools);
  if (l.denyTools?.length) row("denied", l.denyTools.join(", "));
  if (l.spawnableAgents) row("can spawn", l.spawnableAgents.length ? `${l.spawnableAgents.join(", ")}${l.spawnBudget != null ? `  (budget ${l.spawnBudget})` : ""}` : "none");
  if (l.mode) row("mode", [l.mode, l.async ? "async" : "", l.autoExit ? "auto-exit" : ""].filter(Boolean).join(" · "));
  if (l.timeout) row("timeout", `${l.timeout}s`);
  row("cwd", l.cwd ?? i.header?.cwd);
  row("session", opened.sessionFile, C.muted);

  if (i.task) {
    section("Task");
    for (const t of wrap(i.task.trim(), Math.max(10, width - 2))) out.push([["  " + t, C.muted]]);
  }
  return out;
}

// ---------- state, drawing, input ----------

let frame = 0;
let view = "graph";
let selected = null;      // sessionFile of the selected agent
let clickable = [];       // screen row (1-based) -> target, from the last graph draw
let opened = null;        // { sessionFile, name, agent }
let scroll = 0;           // detail lines scrolled up from the bottom; 0 follows

function drawGraph(width, height) {
  const lines = graphLines();
  if (!lines.some(l => l.target?.sessionFile === selected)) selected = lines.find(l => l.target)?.target.sessionFile ?? null;
  // Highlight only the selected agent's first (name) row.
  const selectedLine = lines.find(l => l.target?.sessionFile === selected);
  const footer = { segments: [["click or ↑↓ Enter to open · Ctrl-C quits", C.dim]] };
  const room = height - 2;
  // Keep the newest rows when the tree outgrows the pane.
  const body = lines.length > room ? [lines[0], { segments: [["  …", C.dim]] }, ...lines.slice(lines.length - room + 2)] : lines;
  const shown = [...body, { segments: [[""]] }, footer];
  clickable = shown.map(l => l.target);
  return shown.map(l => {
    return paint(l === selectedLine ? [["▶", C.accent], ...l.segments.map(([t, ...c]) => [t, ...c, C.inverse])] : [[" "], ...l.segments], width);
  });
}

let detailKeys = [];      // screen row (1-based) -> block key, from the last detail draw
let clickedBlock = null;  // { key, row }: keep a toggled block's first line where it was

function drawDetail(width, height) {
  const a = opened.agent;
  const live = a ? a.endTime === undefined : alive(rootPid);
  const header = [
    ["← ", C.accent], [opened.name, C.bold],
    a?.agent && a.agent !== a.name ? [` ${a.agent}`, C.dim] : [""],
    [live ? "  running" : "  done", live ? C.accent : C.green],
    a ? [`  ${elapsed((a.endTime ?? Date.now()) - a.startTime)}`, C.dim] : [""],
    [showInfo ? "  ▴ info" : "  ▸ info", C.accent],
  ];
  if (showInfo) return drawInfo(header, width, height);
  const feed = sessionFeed(opened.sessionFile, width - 1);
  const room = height - 3;
  if (clickedBlock) {
    const first = feed.findIndex(l => l.key === clickedBlock.key);
    if (first >= 0) scroll = feed.length - (first + room - (clickedBlock.row - 3));
    clickedBlock = null;
  }
  scroll = Math.max(0, Math.min(scroll, feed.length - room));
  const end = feed.length - scroll;
  const body = feed.slice(Math.max(0, end - room), end);
  detailKeys = [undefined, undefined, ...body.map(l => l.key)];
  const footer = [
    [scroll ? `↑ ${scroll} lines up · End follows · ` : "following · ", C.dim],
    [`click ▸ to expand · i info · e ${expandAll ? "collapses" : "expands"} all · Esc back`, C.dim],
  ];
  return [paint(header, width), paint([["─".repeat(width), C.dim]], width), ...body.map(l => paint(l.segments, width)), ...Array(Math.max(0, room - body.length)).fill(""), paint(footer, width)];
}

let showInfo = false;     // detail shows the agent's info instead of its feed
let infoScroll = 0;

function drawInfo(header, width, height) {
  const lines = infoLines(width - 1);
  const room = height - 3;
  infoScroll = Math.max(0, Math.min(infoScroll, lines.length - room));
  const body = lines.slice(infoScroll, infoScroll + room);
  detailKeys = [];
  const footer = [["i or click header for transcript · Esc back · ↑↓ scroll", C.dim]];
  return [paint(header, width), paint([["─".repeat(width), C.dim]], width), ...body.map(l => paint(l, width)), ...Array(Math.max(0, room - body.length)).fill(""), paint(footer, width)];
}

function toggleInfo() {
  showInfo = !showInfo;
  infoScroll = 0;
  draw();
}

function toggleAt(row) {
  const key = detailKeys[row - 1];
  if (!key) return;
  // Anchor at the block's first visible row, so it opens downward in place.
  let top = row;
  while (top > 3 && detailKeys[top - 2] === key) top--;
  toggled.has(key) ? toggled.delete(key) : toggled.add(key);
  clickedBlock = { key, row: top };
  draw();
}

function draw() {
  load();
  if (view === "detail" && opened?.agent) {
    // Pick up the agent's latest status from its parent's snapshot.
    for (const snap of bySession.values()) {
      const fresh = snap.agents?.find(x => x.sessionFile === opened.sessionFile);
      if (fresh) opened.agent = fresh;
    }
  }
  const width = process.stdout.columns || 80;
  const height = process.stdout.rows || 24;
  const lines = view === "detail" ? drawDetail(width, height) : drawGraph(width, height);
  process.stdout.write("\x1b[H" + lines.map(l => l + "\x1b[K").join("\n") + "\x1b[J");
  frame++;
}

function open(target) {
  if (!target) return;
  opened = { ...target };
  selected = target.sessionFile;
  view = "detail";
  scroll = 0;
  draw();
}

function moveSelection(delta) {
  const order = [];
  for (const t of clickable) if (t && !order.includes(t.sessionFile)) order.push(t.sessionFile);
  if (!order.length) return;
  const i = Math.max(0, order.indexOf(selected));
  selected = order[Math.max(0, Math.min(order.length - 1, i + delta))];
  draw();
}

function back() {
  view = "graph";
  showInfo = false;
  opened = null;
  draw();
}

function onInput(data) {
  const s = data.toString("utf8");
  if (s === "\x03") return restore();
  // SGR mouse: ESC [ < button ; x ; y (M press | m release)
  for (const m of s.matchAll(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/g)) {
    const [, b, x, y, kind] = m;
    const button = Number(b);
    if (button === 64 || button === 65) {
      const delta = button === 64 ? 3 : -3;
      if (view === "detail" && showInfo) { infoScroll = Math.max(0, infoScroll - delta); draw(); }
      else if (view === "detail") { scroll = Math.max(0, scroll + delta); draw(); }
      else moveSelection(-Math.sign(delta));
    } else if (button === 0 && kind === "M") {
      if (view === "graph") open(clickable[Number(y) - 1]);
      else if (Number(y) === 1) Number(x) <= 2 ? back() : toggleInfo();
      else if (!showInfo) toggleAt(Number(y));
    }
  }
  if (s.startsWith("\x1b[<")) return;
  const height = process.stdout.rows || 24;
  if (view === "detail" && showInfo) {
    const k = { "\x1b[A": -1, "k": -1, "\x1b[B": 1, "j": 1, "\x1b[5~": -(height - 4), "\x1b[6~": height - 4 }[s];
    if (k !== undefined) { infoScroll = Math.max(0, infoScroll + k); draw(); return; }
    if (s === "\x1b" || s === "q" || s === "i" || s === "\x1b[D" || s === "h") { toggleInfo(); return; }
  }
  const keys = {
    "i": () => view === "detail" && toggleInfo(),
    "\x1b[A": () => (view === "detail" ? (scroll++, draw()) : moveSelection(-1)),
    "k": () => (view === "detail" ? (scroll++, draw()) : moveSelection(-1)),
    "\x1b[B": () => (view === "detail" ? (scroll = Math.max(0, scroll - 1), draw()) : moveSelection(1)),
    "j": () => (view === "detail" ? (scroll = Math.max(0, scroll - 1), draw()) : moveSelection(1)),
    "\x1b[5~": () => { if (view === "detail") { scroll += height - 4; draw(); } },
    "\x1b[6~": () => { if (view === "detail") { scroll = Math.max(0, scroll - (height - 4)); draw(); } },
    "\x1b[F": () => { scroll = 0; draw(); },
    "G": () => { scroll = 0; draw(); },
    "\r": () => view === "graph" && open(clickable.find(t => t?.sessionFile === selected)),
    "\x1b[C": () => view === "graph" && open(clickable.find(t => t?.sessionFile === selected)),
    "l": () => view === "graph" && open(clickable.find(t => t?.sessionFile === selected)),
    "\x1b": () => view === "detail" && back(),
    "\x1b[D": () => view === "detail" && back(),
    "h": () => view === "detail" && back(),
    "q": () => (view === "detail" ? back() : undefined),
    "e": () => { if (view === "detail") { expandAll = !expandAll; toggled.clear(); draw(); } },
  };
  keys[s]?.();
}

// alt screen, hidden cursor, SGR mouse reporting
process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h");
function restore() {
  process.stdout.write("\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[?1049l");
  process.exit(0);
}
process.on("SIGINT", restore);
process.on("SIGTERM", restore);
process.on("SIGHUP", restore);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on("data", onInput);
process.stdout.on("resize", draw);
draw();
setInterval(draw, 300);
