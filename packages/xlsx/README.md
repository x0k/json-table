# @json-table/xlsx

The [@office-kit/xlsx](https://github.com/office-kit/xlsx) based XLSX renderer for [JSON Table](https://github.com/x0k/json-table) trees.

## Install

```shell
npm install @json-table/core @json-table/xlsx
```

`@office-kit/xlsx` is a peer dependency and is installed automatically as such.

## Usage

```typescript
import { makeTreeFactory } from "@json-table/core";
import { treesToWorkbook, treesToXlsxBytes } from "@json-table/xlsx";

const createTree = makeTreeFactory({
  cornerCellValue: "№",
  createHeader: (key) => key,
  createIndex: (i) => i + 1,
});

const tree = createTree(data);

/* Create a workbook with a `Table` sheet */
const wb = treesToWorkbook([["Table", tree]]);

/* Or serialize directly to bytes (browser-safe) */
const bytes = await treesToXlsxBytes([["Table", tree]]);
```

Every tree cell is placed on the worksheet with `rowspan`/`colspan`-equivalent merges; header, index and corner cells are rendered in bold (centered, wrapped).

Lower-level helpers are also exported:

- `renderOnWorksheet(ws, wb, tree, options)` — render one tree onto an existing worksheet.
- `calculateSheetData(tree, options)` — compute `{ widths, heights, cells }` without writing anything.

### Sizing

Column widths and row heights are computed with a two-pass autofit algorithm:

1. **Widths** — per column, the p90 of content lengths of the single-row cells occupying it plus one character to compensate for Excel's internal cell padding (so a single huge value wraps instead of widening the column), floored at `cellMinWidth`.
2. **Heights** — estimated wrapped-line counts using pass-1 widths as wrap capacity, spread across merged rows and multiplied by the line height, floored at `cellMinHeight`.

Both floors can be customized through options (`cellMinWidth`, default `10`, in Excel character units; `cellMinHeight`, default `15`, in points):

```typescript
import { treesToXlsxBytes } from "@json-table/xlsx";

const bytes = await treesToXlsxBytes([["Table", tree]], {
  cellMinWidth: 8,
  cellMinHeight: 20,
});
```

## License

MIT
