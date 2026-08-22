import { array } from "./lib/array.js";
import { matrix } from "./lib/matrix.js";

import { type Tree, cells } from "./tree/tree.js";

function getMaxLineLength(rows: string[]) {
  let max = 0;
  for (let i = 0; i < rows.length; i++) {
    max = Math.max(max, rows[i]!.length);
  }
  return max;
}

function padCellRow(row: string, w: number, type: string, rows: string[]) {
  switch (type) {
    case "corner":
    case "header":
    case "index": {
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

export interface ToASCIIOptions {
  format?: ASCIITableFormat;
}

interface InputCell {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  lines: string[];
  maxRowLength: number;
}

function collectInputCells<V>(tree: Tree<V>): InputCell[] {
  return Array.from(cells(tree), ({ node, x, y, width, height }) => {
    const content =
      typeof node.value === "string"
        ? node.value
        : JSON.stringify(node.value, null, 2);
    const lines = content.split("\n").map((r) => ` ${r.trim()} `);
    return {
      x,
      y,
      width,
      height,
      type: node.type,
      lines,
      maxRowLength: getMaxLineLength(lines),
    };
  });
}

function populateShifts(
  inputCells: InputCell[],
  xShift: number[],
  yShift: number[]
) {
  for (const cell of inputCells) {
    xShift[cell.x + 1] = Math.max(
      xShift[cell.x + 1]!,
      Math.max(cell.maxRowLength - cell.width, 0) + 1
    );
    yShift[cell.y + 1] = Math.max(
      yShift[cell.y + 1]!,
      Math.max(cell.lines.length - cell.height, 0) + 1
    );
  }
}

function populateMySqlShifts(
  inputCells: InputCell[],
  xShift: number[],
  yShift: number[]
) {
  xShift[0] = yShift[0] = 1;
  populateShifts(inputCells, xShift, yShift);
}

function populateMarkdownLikeShifts(
  inputCells: InputCell[],
  xShift: number[],
  yShift: number[],
  height: number
) {
  xShift[0] = 1;
  populateShifts(inputCells, xShift, yShift);
  for (let i = 2; i < height; i++) {
    yShift[i]! -= 1;
  }
}

function drawMySqlBorder(
  outMatrix: (string | null)[][],
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
  outMatrix: (string | null)[][],
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
      const previous = !isLeftEdge && outMatrix[i]![j - 1];
      const above = !isTopEdge && outMatrix[i - 1]![j];
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
  [ASCIITableFormat.MarkdownLike]: (
    inputCells: InputCell[],
    xShift: number[],
    yShift: number[],
    height: number
  ) => populateMarkdownLikeShifts(inputCells, xShift, yShift, height),
};

const BORDER_DRAWERS = {
  [ASCIITableFormat.MySQL]: drawMySqlBorder,
  [ASCIITableFormat.MarkdownLike]: drawMarkdownLikeBorder,
};

/** renders a tree as an ASCII table */
export function toASCII<V>(
  tree: Tree<V>,
  { format = ASCIITableFormat.MySQL }: ToASCIIOptions = {}
) {
  const inputCells = collectInputCells(tree);
  const height = tree.height;
  const width = tree.width;
  const xShift = array(width + 1, () => 0);
  const yShift = array(height + 1, () => 0);
  SHIFTS_POPULATORS[format](inputCells, xShift, yShift, height);
  // Accumulate
  for (let i = 1; i <= width; i++) {
    xShift[i]! += xShift[i - 1]!;
  }
  for (let i = 1; i <= height; i++) {
    yShift[i]! += yShift[i - 1]!;
  }
  const outHeight = height + yShift[height]!;
  const outWidth = width + xShift[width]!;
  const outMatrix = matrix<string | null>(outHeight, outWidth, () => null);
  for (const cell of inputCells) {
    const { lines } = cell;
    const rowIndex = cell.y + yShift[cell.y]!;
    const colIndex = cell.x + xShift[cell.x]!;
    // TODO: This `||` is a hack and the `splice` in the markdown-like border fn also
    //       I think there is a general way to compute sizes
    const h =
      cell.height + yShift[cell.y + cell.height]! - yShift[cell.y]! - 1 || 1;
    const w =
      cell.width + xShift[cell.x + cell.width]! - xShift[cell.x]! - 1 || 1;
    const startRow = Math.floor((h - lines.length) / 2);
    const endRow = startRow + lines.length;
    for (let y = 0; y < h; y++) {
      const c = y + rowIndex;
      if (y >= startRow && y < endRow) {
        const row = padCellRow(lines[y - startRow]!, w, cell.type, lines);
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
  BORDER_DRAWERS[format](outMatrix, outWidth, outHeight);
  return outMatrix.map((row) => row.join("")).join("\n");
}
