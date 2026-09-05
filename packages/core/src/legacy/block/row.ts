import type { Rows } from "../json-table.js";

export function shiftPositionsInPlace(columns: number[], offset: number): void {
  for (let i = 0; i < columns.length; i++) {
    columns[i]! += offset;
  }
}

export function scaleRowsVerticallyInPlace<V>(
  { rows, indexes }: Rows<V>,
  multiplier: number
): void {
  for (let i = 0; i < rows.length; i++) {
    indexes[i] = indexes[i]! * multiplier;
    const cells = rows[i]!.cells;
    for (let j = 0; j < cells.length; j++) {
      cells[j]!.height = cells[j]!.height * multiplier;
    }
  }
}

export function scaleRowsHorizontallyInPlace<V>(
  { rows }: Rows<V>,
  multiplier: number
): void {
  for (let i = 0; i < rows.length; i++) {
    const { cells, columns } = rows[i]!;
    for (let j = 0; j < cells.length; j++) {
      cells[j]!.width = cells[j]!.width * multiplier;
      columns[j] = columns[j]! * multiplier;
    }
  }
}
