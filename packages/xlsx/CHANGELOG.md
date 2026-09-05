# @json-table/block-to-xlsx

## 0.5.0

## 0.4.3

## 0.4.2

## 0.4.1

## 0.4.0

### Minor Changes

- [`a26a918`](https://github.com/x0k/json-table/commit/a26a918ebf134cbe3e9fb2e50bd6203b92fe5017) Thanks [@x0k](https://github.com/x0k)! - Rename `@json-table/block-to-xlsx` to `@json-table/xlsx` (**breaking change**)

  The package now consumes the `Tree` model from `@json-table/core` directly via `cells()`.

  Migration guide:

  | Removed                                         | Replacement               |
  | ----------------------------------------------- | ------------------------- |
  | `@json-table/block-to-xlsx` package             | `@json-table/xlsx`        |
  | `renderBlockOnWorksheet(block)` (block-to-xlsx) | `renderOnWorksheet(tree)` |

  `renderOnWorksheet` consumes a `Tree` and traverses it with `cells()`, which yields every cell once together with its matrix position (`x`, `y`) and span (`width`, `height`).

- [#16](https://github.com/x0k/json-table/pull/16) [`c7bae1d`](https://github.com/x0k/json-table/commit/c7bae1d159e242f59ce69353c9668463dd1178be) Thanks [@x0k](https://github.com/x0k)! - Two-pass autofit sizing and migration from `exceljs` to `@office-kit/xlsx` (**breaking changes**)

  Column widths and row heights are no longer computed by user-supplied heuristics.
  The new algorithm mirrors Excel's AutoFit:
  1. Column widths come from the p90 of content lengths of single-row cells per column plus one character of padding (outliers wrap instead of widening the column), floored at `cellMinWidth`.
  2. Row heights are derived from estimated wrapped-line counts using those widths, spread across merged rows, floored at `cellMinHeight`.

  Migration guide:

  | Removed                                                         | Replacement                                            |
  | --------------------------------------------------------------- | ------------------------------------------------------ |
  | `columnWidth` / `rowHeight` callbacks                           | built-in autofit (`cellMinWidth`, `cellMinHeight`)     |
  | `renderOnWorksheet(sheet, tree, options)` (exceljs `Worksheet`) | `renderOnWorksheet(ws, wb, tree, options)`             |
  | `modifyCell` / `modifyRow` / `modifyColumn`                     | none (post-process the workbook yourself)              |
  | exceljs `Workbook` + `writeBuffer()`                            | `treesToWorkbook(tables)` / `treesToXlsxBytes(tables)` |

## 0.3.0

### Patch Changes

- Updated dependencies [[`a8eab26`](https://github.com/x0k/json-table/commit/a8eab264141ce5fd3433c07c6e199d4cd15feb1b)]:
  - @json-table/core@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [[`0045eb0`](https://github.com/x0k/json-table/commit/0045eb0490a1b41e51b2ddafc9644a98187e7064), [`e6a7a7e`](https://github.com/x0k/json-table/commit/e6a7a7e598c0dba2ee5b407fc2f9e55e579a8862), [`76dd5d5`](https://github.com/x0k/json-table/commit/76dd5d54e8be6ae554603f0a814bb33b1fc04951), [`9e41f2a`](https://github.com/x0k/json-table/commit/9e41f2adac65b15692a1cd02abd86e8d34f5dd8c)]:
  - @json-table/core@0.2.0

## 0.1.0

### Patch Changes

- Updated dependencies [[`a089b62`](https://github.com/x0k/json-table/commit/a089b628379acfef7bf1b56a6e85235bb442ec3a)]:
  - @json-table/core@0.1.0
