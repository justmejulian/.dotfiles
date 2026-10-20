import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { sliceByColumn, visibleWidth } from "@earendil-works/pi-tui";

/** Complete the main editor's horizontal rules without replacing pi-vim. */
export default function (pi: ExtensionAPI) {
  let restore: (() => void) | undefined;

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui" || restore) return;

    // pi-vim calls CustomEditor.render(), so decorating this method preserves
    // its modal editing, cursor handling, and mode label. Padding reserves the
    // side columns without shifting mouse coordinates or changing wrapping.
    const original = CustomEditor.prototype.render;
    const wrapped: typeof original = function (width) {
      if (width < 7) return original.call(this, width);
      const padding = this.getPaddingX();
      this.setPaddingX(Math.max(2, padding));
      let lines: string[];
      try {
        lines = original.call(this, width);
      } finally {
        this.setPaddingX(padding);
      }

      // Pi 1.2's editor records the visible input rows separately from its
      // autocomplete rows. Only frame the input; leave completion menus alone.
      const bottom = 1 + (this as unknown as { renderedVisibleLineCount: number }).renderedVisibleLineCount;
      if (!Number.isInteger(bottom) || bottom >= lines.length) return lines;
      return lines.map((line, row) => {
        if (row > bottom) return line;
        const left = row === 0 ? "╭" : row === bottom ? "╰" : "│";
        const right = row === 0 ? "╮" : row === bottom ? "╯" : "│";
        const middle = sliceByColumn(line, 1, width - 2, true);
        return this.borderColor(left) + middle +
          " ".repeat(Math.max(0, width - 2 - visibleWidth(middle))) + this.borderColor(right);
      });
    };
    CustomEditor.prototype.render = wrapped;
    restore = () => {
      if (CustomEditor.prototype.render === wrapped) CustomEditor.prototype.render = original;
      restore = undefined;
    };
  });

  pi.on("session_shutdown", () => restore?.());
}
