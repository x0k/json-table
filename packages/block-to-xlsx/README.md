# @json-table/block-to-xlsx

The [exceljs](https://github.com/exceljs/exceljs) based block to XLSX converter for [JSON Table](https://github.com/x0k/json-table).

## Install

```shell
npm install @json-table/core @json-table/block-to-xlsx
```

## Usage

```typescript
import { makeTableInPlaceBaker, makeTableFactory } from "@json-table/core/json-to-table";
import { renderBlockOnWorksheet } from "@json-table/block-to-xlsx";
import { Workbook } from "exceljs";

const cornerCellValue = "№";
const factory = makeTableFactory({ cornerCellValue });
const bake = makeTableInPlaceBaker({ cornerCellValue, head: true, indexes: true });
const wb = new Workbook();
renderBlockOnWorksheet(wb.addWorksheet("Table"), bake(factory(data)));
```

## License

MIT
