import { escapeHtml } from "./lib/html.js";

import { type Block, CellType } from "./json-table.js";

export function blockToHTML(model: Block) {
  const rows: string[] = [];
  let r = 0;
  let index = model.data.indexes[r];
  for (let i = 0; i < model.height; i++) {
    if (i === index) {
      const row = model.data.rows[r]!;
      rows.push(
        `<tr>${row.cells
          .map((cell) => {
            const val =
              typeof cell.value === "string"
                ? escapeHtml(cell.value)
                : cell.value;
            return `<td colspan="${cell.width}" rowspan="${cell.height}">${
              cell.type !== CellType.Value ? `<b>${val}</b>` : val
            }</td>`;
          })
          .join("\n")}</tr>`
      );
      index = model.data.indexes[++r];
    } else {
      rows.push(`<tr></tr>`);
    }
  }
  return `<table>${rows.join("\n")}</table>`;
}
