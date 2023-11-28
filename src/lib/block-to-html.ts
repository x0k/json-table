import { Block, CellType } from "@/lib/json-table";
import { Entry } from "@/lib/entry";
import { escapeHtml } from "@/lib/html";

export const HTML_TABLE_STYLES = `table, th, td {border: 1px solid black; border-collapse: collapse;} th, td {padding: 5px; text-align: left;} th:has(> b), td:has(> b) {text-align: center;}`;

export function renderTable(model: Block) {
  return `<table>${model.rows
    .map(
      (row) =>
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
    )
    .join("\n")}</table>`;
}

export function makeHTMLPageContent(tables: Entry<Block>[]) {
  return tables.length > 1
    ? tables
        .map(([title, table]) => `<h2>${title}</h2>${renderTable(table)}`)
        .join("<br />")
    : renderTable(tables[0][1]);
}
