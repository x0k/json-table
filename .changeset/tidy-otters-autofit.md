---
"@json-table/xlsx": minor
---

Two-pass autofit sizing and migration from `exceljs` to `@office-kit/xlsx` (**breaking changes**)

Column widths and row heights are no longer computed by user-supplied heuristics.
The new algorithm mirrors Excel's AutoFit:

1. Column widths come from the p90 of content lengths of single-row cells per column plus one character of padding (outliers wrap instead of widening the column), floored at `cellMinWidth`.
2. Row heights are derived from estimated wrapped-line counts using those widths, spread across merged rows, floored at `cellMinHeight`.

Migration guide:

| Removed                                                          | Replacement                                    |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| `columnWidth` / `rowHeight` callbacks                            | built-in autofit (`cellMinWidth`, `cellMinHeight`) |
| `renderOnWorksheet(sheet, tree, options)` (exceljs `Worksheet`)  | `renderOnWorksheet(ws, wb, tree, options)`     |
| `modifyCell` / `modifyRow` / `modifyColumn`                      | none (post-process the workbook yourself)      |
| exceljs `Workbook` + `writeBuffer()`                             | `treesToWorkbook(tables)` / `treesToXlsxBytes(tables)` |
