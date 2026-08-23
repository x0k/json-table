import { escapeHtml } from "./lib/html.js";
import { type Tree, cells } from "./model.js";

/** renders a tree as an HTML table */
export function toHTML<V>(tree: Tree<V>): string {
  const rows: { x: number; td: string }[][] = new Array(tree.height);
  for (let y = 0; y < tree.height; y++) {
    rows[y] = [];
  }
  for (const { node, x, y, width, height } of cells(tree)) {
    const val =
      typeof node.value === "string" ? escapeHtml(node.value) : node.value;
    rows[y]!.push({
      x,
      td: `<td colspan="${width}" rowspan="${height}">${
        node.type !== "leaf" ? `<b>${val}</b>` : val
      }</td>`,
    });
  }
  const trs: string[] = new Array(tree.height);
  for (let y = 0; y < tree.height; y++) {
    trs[y] = `<tr>${rows[y]!
      .sort((a, b) => a.x - b.x)
      .map((c) => c.td)
      .join("\n")}</tr>`;
  }
  return `<table>${trs.join("\n")}</table>`;
}
