import {
  type Cell as ExcelCell,
  type Column,
  type Row,
  type Worksheet,
} from "exceljs";

import type { Matrix } from "@json-table/core/lib/matrix";
import { array } from "@json-table/core/lib/array";
import { max, sum } from "@json-table/core/lib/math";
import type { JSONPrimitive } from "@json-table/core/lib/json";
import { type Block, type Cell, CellType } from "@json-table/core";
import { createMatrix, fromMatrix } from "@json-table/core/block-matrix";

export interface MatrixData {
  cell: Cell;
  count: number;
}

export interface CalculateSheetDataOptions {
  columnWidth: (
    column: MatrixData[],
    columnIndex: number,
    matrix: Matrix<MatrixData>,
    table: Block
  ) => number;
  rowHeight: (
    row: MatrixData[],
    rowIndex: number,
    matrix: Matrix<MatrixData>,
    table: Block
  ) => number;
}

export function calculateSheetData(
  table: Block,
  { columnWidth, rowHeight }: CalculateSheetDataOptions
) {
  const { width } = table;
  const matrix = createMatrix(table, (cell) => ({
    cell,
    count:
      typeof cell.value === "string" || typeof cell.value === "number"
        ? String(cell.value).length / cell.height / cell.width
        : 0,
  }));
  const cells = fromMatrix(
    matrix,
    (cell) => cell.cell.type,
    (cell, row, col) => ({ value: cell.cell.value, row: row + 1, col: col + 1 })
  ).data.rows.flatMap((r) => r.cells);
  return {
    widths: array(width, (i) =>
      columnWidth(
        matrix.map((row) => row[i]!),
        i,
        matrix,
        table
      )
    ),
    heights: matrix.map((row, i) => rowHeight(row, i, matrix, table)),
    cells,
  };
}

export type MakeWorkBookOptions = Partial<
  CalculateSheetDataOptions & {
    cellMinHeight: number;
    cellMinWidth: number;
    modifyColumn: (column: Column, columnIndex: number) => void;
    modifyRow: (row: Row, rowIndex: number) => void;
    modifyCell: (
      sheetCell: ExcelCell,
      matrixCell: Cell<{
        value: JSONPrimitive;
        col: number;
        row: number;
      }>,
      matrixCellIndex: number
    ) => void;
  }
>;

export function renderBlockOnWorksheet(
  sheet: Worksheet,
  block: Block,
  {
    cellMinHeight = 22,
    cellMinWidth = 10,
    modifyCell,
    modifyColumn,
    modifyRow,
    ...options
  }: MakeWorkBookOptions = {}
) {
  const { heights, widths, cells } = calculateSheetData(block, {
    columnWidth: (column) => {
      const counts = column.map((cell) => cell.count);
      return Math.max(
        Math.ceil(counts.reduce(sum) / block.height + counts.reduce(max)),
        cellMinWidth
      );
    },
    rowHeight: (row) =>
      Math.max(
        Math.ceil(
          (row.map(({ count }) => count).reduce(sum) / block.width) * 2
        ),
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
  cells.forEach((matrixCell, i) => {
    const {
      height,
      width,
      type,
      value: { col, row, value },
    } = matrixCell;
    const sheetCell = sheet.getRow(row).getCell(col);
    sheetCell.value = value;
    sheetCell.alignment = { vertical: "middle", wrapText: true };
    if (type !== CellType.Value) {
      sheetCell.font = { bold: true };
    }
    modifyCell?.(sheetCell, matrixCell, i);
    if (height > 1 || width > 1) {
      sheet.mergeCells(row, col, row + height - 1, col + width - 1);
    }
  });
}
