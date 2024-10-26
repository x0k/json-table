import { array } from "../lib/array.js";
import { type Matrix, matrix } from "../lib/matrix.js";

import { type Block, type Cell, CellType } from "../json-table.js";
import { createMatrix } from "../block-matrix.js";

function getMaxLineLength(rows: string[]) {
  let max = 0;
  for (let i = 0; i < rows.length; i++) {
    max = Math.max(max, rows[i]!.length);
  }
  return max;
}

function padCellRow(row: string, w: number, cell: Cell, rows: string[]) {
  switch (cell.type) {
    case CellType.Corner:
    case CellType.Header:
    case CellType.Index: {
      const p = Math.floor((w - row.length) / 2);
      return (p > 0 ? row.padStart(p + row.length) : row).padEnd(w);
    }
    default: {
      if (rows.length === 1 && !isNaN(Number(row))) {
        return row.padStart(w);
      }
      return row.padEnd(w);
    }
  }
}

export enum ASCIITableFormat {
  MySQL = "MySql",
  MarkdownLike = "Markdown Like",
}

export const ASCII_TABLE_FORMATS = Object.values(ASCIITableFormat);

export interface BlockToASCIIOptions {
  format?: ASCIITableFormat;
}

interface InputCell {
  cell: Cell;
  rowIndex: number;
  collIndex: number;
  lines: string[];
  maxRowLength: number;
}

function populateShifts(
  block: Block,
  inputMatrix: Matrix<InputCell>,
  xShift: number[],
  yShift: number[]
) {
  for (let i = 0; i < block.height; i++) {
    for (let j = 0; j < block.width; j++) {
      const cell = inputMatrix[i]![j]!;
      if (cell.collIndex === j) {
        xShift[j + 1] = Math.max(
          xShift[j + 1]!,
          Math.max(cell.maxRowLength - cell.cell.width, 0) + 1
        );
      }
      if (cell.rowIndex === i) {
        yShift[i + 1] = Math.max(
          yShift[i + 1]!,
          Math.max(cell.lines.length - cell.cell.height, 0) + 1
        );
      }
    }
  }
}

function populateMySqlShifts(
  block: Block,
  inputMatrix: Matrix<InputCell>,
  xShift: number[],
  yShift: number[]
) {
  xShift[0] = yShift[0] = 1;
  populateShifts(block, inputMatrix, xShift, yShift);
}

function populateMarkdownLikeShifts(
  block: Block,
  inputMatrix: Matrix<InputCell>,
  xShift: number[],
  yShift: number[]
) {
  xShift[0] = 1;
  populateShifts(block, inputMatrix, xShift, yShift);
  for (let i = 2; i < inputMatrix.length; i++) {
    yShift[i]! -= 1;
  }
}

function drawMySqlBorder(
  outMatrix: Matrix<string | null>,
  width: number,
  height: number
) {
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const cell = outMatrix[i]![j]!;
      if (cell !== null) {
        continue;
      }
      const isLeftEdge = j === 0;
      const isTopEdge = i === 0;
      const isRightEdge = j === width - 1;
      const isBottomEdge = i === height - 1;
      const previous = !isLeftEdge && outMatrix[i]![j - 1]!;
      const next = !isRightEdge && outMatrix[i]![j + 1]!;
      const beneath = !isBottomEdge && outMatrix[i + 1]![j]!;
      const above = !isTopEdge && outMatrix[i - 1]![j]!;
      if (
        ((isLeftEdge || isRightEdge) && (isTopEdge || isBottomEdge)) ||
        (previous === "-" && beneath === null) ||
        (above === "|" && next === null) ||
        (previous === "-" && above === "|")
      ) {
        outMatrix[i]![j] = "+";
        continue;
      }
      if (previous === "+" || previous === "-") {
        outMatrix[i]![j] = "-";
        continue;
      }
      if (above === "+" || above === "|") {
        outMatrix[i]![j] = "|";
        continue;
      }
      outMatrix[i]![j] = "n";
    }
  }
}

function drawMarkdownLikeBorder(
  outMatrix: Matrix<string | null>,
  width: number,
  height: number
) {
  outMatrix.splice(height - 1, 1);
  for (let i = 0; i < height - 1; i++) {
    for (let j = 0; j < width; j++) {
      const cell = outMatrix[i]![j];
      if (cell !== null) {
        continue;
      }
      const isLeftEdge = j === 0;
      const isTopEdge = i === 0;
      // const isRightEdge = j === width - 1;
      // const isBottomEdge = i === height - 1;
      const previous = !isLeftEdge && outMatrix[i]![j - 1];
      const above = !isTopEdge && outMatrix[i - 1]![j];
      // const next = !isRightEdge && outMatrix[i][j + 1];
      // const beneath = !isBottomEdge && outMatrix[i + 1][j];
      if ((previous === "|" || previous === "-") && above !== "|") {
        outMatrix[i]![j] = "-";
        continue;
      }
      outMatrix[i]![j] = "|";
    }
  }
}

const SHIFTS_POPULATORS = {
  [ASCIITableFormat.MySQL]: populateMySqlShifts,
  [ASCIITableFormat.MarkdownLike]: populateMarkdownLikeShifts,
};

const BORDER_DRAWERS = {
  [ASCIITableFormat.MySQL]: drawMySqlBorder,
  [ASCIITableFormat.MarkdownLike]: drawMarkdownLikeBorder,
};

export function blockToASCII(
  block: Block,
  { format = ASCIITableFormat.MySQL }: BlockToASCIIOptions = {}
) {
  const inputMatrix = createMatrix(
    block,
    (cell, rowIndex, collIndex): InputCell => {
      const content =
        typeof cell.value === "string"
          ? cell.value
          : JSON.stringify(cell.value, null, 2);
      const lines = content.split("\n").map((r) => ` ${r.trim()} `);
      return {
        cell,
        rowIndex,
        collIndex,
        lines,
        maxRowLength: getMaxLineLength(lines),
      };
    }
  );
  const xShift = array(block.width + 1, () => 0);
  const yShift = array(block.height + 1, () => 0);
  SHIFTS_POPULATORS[format](block, inputMatrix, xShift, yShift);
  // Accumulate
  for (let i = 1; i <= block.width; i++) {
    xShift[i]! += xShift[i - 1]!;
  }
  for (let i = 1; i <= block.height; i++) {
    yShift[i]! += yShift[i - 1]!;
  }
  const height = block.height + yShift[block.height]!;
  const width = block.width + xShift[block.width]!;
  const outMatrix = matrix<string | null>(height, width, () => null);
  const placed = new Set<Cell>();
  for (let i = 0; i < block.height; i++) {
    for (let j = 0; j < block.width; j++) {
      const { cell, lines } = inputMatrix[i]![j]!;
      if (placed.has(cell)) {
        continue;
      }
      placed.add(cell);
      const rowIndex = i + yShift[i]!;
      const colIndex = j + xShift[j]!;
      // TODO: This `||` is a hack and the `splice` in the markdown-like border fn also
      //       I think there is a general way to compute sizes
      const h = cell.height + yShift[i + cell.height]! - yShift[i]! - 1 || 1;
      const w = cell.width + xShift[j + cell.width]! - xShift[j]! - 1 || 1;
      const startRow = Math.floor((h - lines.length) / 2);
      const endRow = startRow + lines.length;
      for (let y = 0; y < h; y++) {
        const c = y + rowIndex;
        if (y >= startRow && y < endRow) {
          const row = padCellRow(lines[y - startRow]!, w, cell, lines);
          for (let x = 0; x < w; x++) {
            outMatrix[c]![x + colIndex] = row[x]!;
          }
        } else {
          for (let x = 0; x < w; x++) {
            outMatrix[c]![x + colIndex] = " ";
          }
        }
      }
    }
  }
  BORDER_DRAWERS[format](outMatrix, width, height);
  return outMatrix.map((row) => row.join("")).join("\n");
}
