import { array } from "./lib/array.js";
import { type Matrix, matrix } from "./lib/matrix.js";

import { compressRawRowsInPlaceAndMakeIndexes } from './block/index.js';

import { type Block, type Cells, CellType, type Cell } from "./json-table.js";

const UNDEFINED_CELL = Symbol("undefined cell");

export function createMatrix<T, R>(
  { height, width, data }: Block<T>,
  getValue: (
    cell: Cell<T>,
    rowIndex: number,
    colIndex: number,
    indexInRow: number
  ) => R
): Matrix<R> {
  const m = matrix<typeof UNDEFINED_CELL | R>(
    height,
    width,
    () => UNDEFINED_CELL
  );
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i]!;
    const index = data.indexes[i]!;
    for (let j = 0; j < row.cells.length; j++) {
      const cell = row.cells[j]!;
      const col = row.columns[j]!;
      const { height: cellHeight, width: cellWidth } = cell;
      const value = getValue(cell, index, col, j);
      for (let h = index; h < index + cellHeight && h < height; h++) {
        for (let w = col; w < col + cellWidth && w < width; w++) {
          m[h]![w] = value;
        }
      }
    }
  }
  return m as Matrix<R>;
}

/** Uses reference equality to define cell boundaries */
export function fromMatrix<T, R>(
  matrix: Matrix<T>,
  getCellType: (value: T, rowIndex: number, colIndex: number) => CellType,
  getCellValue: (value: T, rowIndex: number, colIndex: number) => R
): Block<R> {
  const height = matrix.length;
  const width = matrix[0]!.length;
  const cells = new Set<T>();
  const rows = array(
    height,
    (): Cells<R> => ({
      cells: [],
      columns: [],
    })
  );
  for (let i = 0; i < height; i++) {
    let j = 0;
    while (j < width) {
      const cell = matrix[i]![j]!;
      if (cells.has(cell)) {
        j++;
        continue;
      }
      let h = 1;
      while (i + h < height && matrix[i + h]![j] === cell) {
        h++;
      }
      const wStart = j++;
      while (j < width && matrix[i]![j] === cell) {
        j++;
      }
      rows[i]!.cells.push({
        height: h,
        width: j - wStart,
        type: getCellType(cell, i, wStart),
        value: getCellValue(cell, i, wStart),
      });
      rows[i]!.columns.push(wStart);
      cells.add(cell);
    }
  }
  const indexes = compressRawRowsInPlaceAndMakeIndexes(rows);
  return {
    height,
    width,
    data: { rows, indexes },
  };
}
