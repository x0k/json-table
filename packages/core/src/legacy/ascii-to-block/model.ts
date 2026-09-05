import type { Matrix } from "../lib/matrix.js";

export enum SeparatorType {
  None = 0,
  Horizontal = 1,
  Vertical = 2,
  Both = 3,
}

export type RawCell = {
  x1: number;
  y1: number;
  y2: number;
  x2: number;
} | null;

/** Does not escape for separators */
export function getSimpleMySqlASCIITableSeparatorType(
  char: string,
  colIndex: number,
  row: string,
  rowIndex: number,
  rows: string[]
) {
  switch (char) {
    case "+": {
      return SeparatorType.Both;
      // const x = colIndex === row.length - 1 || row[colIndex + 1] === "-" ? SeparatorType.Horizontal : 0;
      // const y = rowIndex === rows.length - 1 || rows[rowIndex + 1][colIndex] === "|" ? SeparatorType.Vertical : 0;
      // return x | y;
    }
    case "|":
      return SeparatorType.Horizontal;
    // TODO: Check that line ends is a `both` separators
    case "-": {
      if (row.length < 2) {
        return SeparatorType.Vertical;
      }
      const prevOrNextInRowToken =
        colIndex > 0 ? row[colIndex - 1] : row[colIndex + 1];
      return prevOrNextInRowToken === "-" || prevOrNextInRowToken === "+"
        ? SeparatorType.Vertical
        : SeparatorType.None;
    }
    default:
      return SeparatorType.None;
  }
}

export function getContentOfRawCell(
  rows: string[],
  { x1, y1, x2, y2 }: NonNullable<RawCell>
) {
  return rows
    .slice(y1, y2 + 1)
    .map((row) => row.substring(x1, x2 + 1).trim())
    .join("\n");
}

export function printRawMatrix(matrix: Matrix<RawCell>) {
  const cells = new Set();
  const cellsIds = new Map<RawCell, string>();
  let lastId = 1;
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i]!.length; j++) {
      const cell = matrix[i]![j]!;
      if (cell !== null && !cells.has(cell)) {
        cells.add(cell);
        cellsIds.set(cell, String(lastId++));
      }
    }
  }
  const pad = lastId.toString().length;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i]!;
    let str = "";
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (cell) {
        str += cellsIds.get(cell)!.padStart(pad, " ");
      } else {
        str += "+".repeat(pad);
      }
    }
    console.log(str);
  }
}

export function omitEmptyLines(rows: string[]) {
  let l = 0;
  while (l < rows.length) {
    if (rows[l]!.trim() === "") {
      rows.splice(l, 1);
    } else {
      l++;
    }
  }
}

export function getMaxLineLength(rows: string[]) {
  let max = 0;
  for (let i = 0; i < rows.length; i++) {
    max = Math.max(max, rows[i]!.length);
  }
  return max;
}
