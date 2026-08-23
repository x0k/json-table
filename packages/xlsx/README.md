# @json-table/xlsx

The [@office-kit/xlsx](https://github.com/office-kit/xlsx) based XLSX renderer for [JSON Table](https://github.com/x0k/json-table) trees.

## Install

```shell
npm install @json-table/core @json-table/xlsx
```

## Usage

```typescript
import { makeTreeFactory } from "@json-table/core";
import { treesToWorkbook, treesToXlsxBytes } from "@json-table/xlsx";

const createTree = makeTreeFactory({
  cornerCellValue: "№",
  createHeader: (key) => key,
  createIndex: (i) => i + 1,
});

const wb = treesToWorkbook([["Table", createTree(data)]]);
const bytes = await treesToXlsxBytes([["Table", createTree(data)]]);
```

Column widths and row heights are computed with a two-pass autofit algorithm
(p90-based column widths with wrap-aware row heights), configurable via
`cellMinWidth` and `cellMinHeight` options.

## License

MIT
