import { Workbook } from "exceljs";
import type { Tree } from "@json-table/core";
import type { JSONValue } from "@json-table/core/lib/json";
import {
  renderOnWorksheet,
  type MakeWorkBookOptions,
} from "@json-table/block-to-xlsx";

import type { Entry } from "@/lib/entry";

export function makeWorkBook(
  tables: Entry<Tree<JSONValue>>[],
  options?: MakeWorkBookOptions<JSONValue>
): Workbook {
  const wb = new Workbook();
  tables.forEach(([title, tree]) => {
    renderOnWorksheet(wb.addWorksheet(title), tree, options);
  });
  return wb;
}
