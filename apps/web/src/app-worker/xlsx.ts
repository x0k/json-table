import { Workbook } from "exceljs";
import type { Block } from "@json-table/core";
import {
  renderBlockOnWorksheet,
  type MakeWorkBookOptions,
} from "@json-table/block-to-xlsx";

import type { Entry } from "@/lib/entry";

export function makeWorkBook(
  tables: Entry<Block>[],
  options?: MakeWorkBookOptions
): Workbook {
  const wb = new Workbook();
  tables.forEach(([title, table]) => {
    renderBlockOnWorksheet(wb.addWorksheet(title), table, options);
  });
  return wb;
}
