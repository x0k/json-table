import { array } from "../lib/array.js";
import { matrix } from "../lib/matrix.js";

import { CellType } from "../json-table.js";
import { fromMatrix } from '../block-matrix.js';

import {
  getContentOfRawCell,
  getMaxLineLength,
  omitEmptyLines,
  type RawCell,
  SeparatorType,
} from "./model.js";

export function ASCIIToBlock(
  ascii: string,
  getSeparatorType: (
    char: string,
    colIndex: number,
    row: string,
    rowIndex: number,
    rows: string[]
  ) => SeparatorType
) {
  const rows = ascii.split("\n");
  omitEmptyLines(rows);
  const originalHeight = rows.length;
  const originalWidth = getMaxLineLength(rows);
  const regions = matrix<RawCell>(
    originalHeight + 1,
    originalWidth + 1,
    () => null
  );
  const xShift = array(originalWidth + 1, () => 0);
  const yShift = array(originalHeight + 1, () => 0);
  for (let i = 0; i < originalHeight; i++) {
    const row = rows[i]!;
    for (let j = 0; j < originalWidth; j++) {
      const char = row[j]!;
      const separatorType = getSeparatorType(char, j, row, i, rows);
      xShift[j + 1] = Math.max(xShift[j + 1]!, separatorType & 1);
      yShift[i + 1] = Math.max(yShift[i + 1]!, (separatorType & 2) >> 1);
      if (separatorType > 0) {
        continue;
      }
      const region = regions[i + 1]![j] ||
        regions[i]![j + 1] || {
          x1: j,
          y1: i,
          x2: j,
          y2: i,
        };
      region.x2 = j;
      region.y2 = i;
      regions[i + 1]![j + 1] = region;
    }
  }
  // Accumulate
  for (let i = 1; i <= originalWidth; i++) {
    xShift[i]! += xShift[i - 1]!;
  }
  for (let i = 1; i <= originalHeight; i++) {
    yShift[i]! += yShift[i - 1]!;
  }
  const width = originalWidth - xShift[originalWidth]!;
  const height = originalHeight - yShift[originalHeight]!;
  const cleanMatrix = matrix<RawCell>(height, width, () => null);
  for (let i = 1; i <= originalHeight; i++) {
    for (let j = 1; j <= originalWidth; j++) {
      const region = regions[i]![j]!;
      if (region === null) {
        continue;
      }
      cleanMatrix[i - yShift[i]! - 1]![j - xShift[j]! - 1] = region;
    }
  }
  return fromMatrix(
    cleanMatrix,
    (_, rowIndex) => (rowIndex === 0 ? CellType.Header : CellType.Value),
    (cell) => {
      if (cell === null) {
        throw new Error("Invalid table");
      }
      return getContentOfRawCell(rows, cell);
    }
  );
}
