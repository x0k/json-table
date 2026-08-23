# @json-table/xlsx

The [exceljs](https://github.com/exceljs/exceljs) based XLSX renderer for [JSON Table](https://github.com/x0k/json-table) trees.

## Install

```shell
npm install @json-table/core @json-table/xlsx
```

## Usage

```typescript
import { makeTreeFactory } from "@json-table/core";
import { renderOnWorksheet } from "@json-table/xlsx";
import { Workbook } from "exceljs";

const createTree = makeTreeFactory({
  cornerCellValue: "№",
  createHeader: (key) => key,
  createIndex: (i) => i + 1,
});

const wb = new Workbook();
renderOnWorksheet(wb.addWorksheet("Table"), createTree(data));
```

## License

MIT
