import {
  type Cell as ExcelCell,
  type Column,
  type Row,
  type Worksheet,
} from "exceljs";

import { array } from "@json-table/core/lib/array";
import { max, sum } from "@json-table/core/lib/math";
import type { JSONPrimitive } from "@json-table/core/lib/json";
import { type LeafValue, type Tree, cells } from "@json-table/core";

type SheetCellType = "header" | "index" | "corner" | "leaf";

export interface SheetCell {
  height: number;
  width: number;
  type: SheetCellType;
  value: {
    value: JSONPrimitive;
    col: number;
    row: number;
  };
}

export interface CalculateSheetDataOptions<V> {
  columnWidth: (
    counts: number[],
    columnIndex: number,
    tree: Tree<V>
  ) => number;
  rowHeight: (counts: number[], rowIndex: number, tree: Tree<V>) => number;
}

function cellCount(value: unknown, width: number, height: number): number {
  return typeof value === "string" || typeof value === "number"
    ? String(value).length / width / height
    : 0;
}

export function calculateSheetData<V>(
  tree: Tree<V>,
  { columnWidth, rowHeight }: CalculateSheetDataOptions<V>
) {
  const height = tree.height;
  const width = tree.width;
  const columnCounts = array(width, () => 0);
  const rowCounts = array(height, () => 0);
  const sheetCells: SheetCell[] = [];
  for (const { node, x, y, width: w, height: h } of cells(tree)) {
    for (let j = x; j < x + w; j++) {
      columnCounts[j]! += cellCount(node.value, w, h) * h;
    }
    for (let i = y; i < y + h; i++) {
      rowCounts[i]! += cellCount(node.value, w, h) * w;
    }
    sheetCells.push({
      height: h,
      width: w,
      type: node.type,
      value: { value: node.value as LeafValue<V> & JSONPrimitive, col: x + 1, row: y + 1 },
    });
  }
  return {
    widths: columnCounts.map((_, i) => columnWidth(columnCounts, i, tree)),
    heights: rowCounts.map((_, i) => rowHeight(rowCounts, i, tree)),
    cells: sheetCells,
  };
}

export type MakeWorkBookOptions<V> = Partial<
  CalculateSheetDataOptions<V> & {
    cellMinHeight: number;
    cellMinWidth: number;
    modifyColumn: (column: Column, columnIndex: number) => void;
    modifyRow: (row: Row, rowIndex: number) => void;
    modifyCell: (
      sheetCell: ExcelCell,
      cell: SheetCell,
      cellIndex: number
    ) => void;
  }
>;

export function renderOnWorksheet<V>(
  sheet: Worksheet,
  tree: Tree<V>,
  {
    cellMinHeight = 22,
    cellMinWidth = 10,
    modifyCell,
    modifyColumn,
    modifyRow,
    ...options
  }: MakeWorkBookOptions<V> = {}
) {
  const { heights, widths, cells } = calculateSheetData(tree, {
    columnWidth: (counts) =>
      Math.max(
        Math.ceil(counts.reduce(sum) / tree.height + counts.reduce(max)),
        cellMinWidth
      ),
    rowHeight: (counts) =>
      Math.max(
        Math.ceil((counts.reduce(sum) / tree.width) * 2),
        cellMinHeight
      ),
    ...options,
  });
  widths.forEach((width, i) => {
    const column = sheet.getColumn(i + 1);
    column.width = width;
    modifyColumn?.(column, i + 1);
  });
  heights.forEach((height, i) => {
    const row = sheet.getRow(i + 1);
    row.height = height;
    modifyRow?.(row, i + 1);
  });
  cells.forEach((cell, i) => {
    const {
      height,
      width,
      type,
      value: { col, row, value },
    } = cell;
    const sheetCell = sheet.getRow(row).getCell(col);
    sheetCell.value = value;
    sheetCell.alignment = { vertical: "middle", wrapText: true };
    if (type !== "leaf") {
      sheetCell.font = { bold: true };
    }
    modifyCell?.(sheetCell, cell, i);
    if (height > 1 || width > 1) {
      sheet.mergeCells(row, col, row + height - 1, col + width - 1);
    }
  });
}
