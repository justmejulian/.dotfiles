// Gives worktree spaces made by Herdr's New/Open worktree pi, lazygit and
// shell tabs, through `hc-worktree tabs <space>`. Shown as an empty floating
// block in the layout; it re-renders whenever the spaces change.
//
// A space gets them when it is new since the app started, its folder is under
// ~/Documents/git/worktree (or ~/.herdr/worktrees, a symlink to it), and it
// has one tab nobody named (hc-worktree's own spaces name their first tab, so
// they are left alone).

import { View, div } from "gpui-kit";
import { spaces, exec, home, notify } from "herdr";

export default class WorktreeTabs extends View {
  init() {
    this.seen = new Set(spaces().map((s) => s.id));
  }

  check(cx) {
    const roots = [`${home()}/Documents/git/worktree/`, `${home()}/.herdr/worktrees/`];
    for (const s of spaces()) {
      // A space can show up before its first tab does.
      if (this.seen.has(s.id) || s.tabs.length === 0) continue;
      this.seen.add(s.id);
      if (s.machine || !roots.some((r) => s.folder.startsWith(r)) || s.tabs.length !== 1 || s.tabs[0].named) continue;
      cx.spawn(async () => {
        const r = await exec(`${home()}/.local/bin/hc-worktree`, ["tabs", s.id]).catch((e) => ({ code: 1, stderr: String(e) }));
        if (r.code !== 0) notify({ title: "hc-worktree tabs", body: r.stderr || `exit ${r.code}`, level: "error" });
      });
    }
  }

  render(cx) {
    this.check(cx);
    return div();
  }
}
