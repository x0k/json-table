import {
  createWorkbook,
  addWorksheet,
  type Workbook,
} from "@office-kit/xlsx/workbook";
import {
  setCell,
  mergeCells,
  setColumnWidths,
  setRowHeights,
  type Worksheet,
} from "@office-kit/xlsx/worksheet";
import { makeAlignment, makeFont, setCellStyle } from "@office-kit/xlsx/styles";
import { workbookToBytes } from "@office-kit/xlsx/io";

import { array } from "@json-table/core/lib/array";
import type { JSONPrimitive } from "@json-table/core/lib/json";
import { type Tree, type LeafValue, cells } from "@json-table/core";

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

export interface CalculateSheetDataOptions {
  cellMinWidth?: number;
  cellMinHeight?: number;
}

/** Height in points of a single text line in the default Excel font */
const LINE_HEIGHT = 15;

function contentLength(value: unknown): number {
  return typeof value === "string" || typeof value === "number"
    ? String(value).length
    : 0;
}

/**
 * Nearest-rank percentile of `values`.
 * Returns 0 for an empty list.
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    Math.max(Math.ceil(p * sorted.length) - 1, 0),
    sorted.length - 1
  );
  return sorted[index]!;
}

/**
 * Two-pass autofit sizing.
 *
 * Pass 1 derives column widths from the lengths of single-row cells
 * occupying each column (p90, so a single huge string wraps instead of
 * blowing up the column). Pass 2 derives row heights from estimated
 * wrapped-line counts, using the widths computed by pass 1 as wrap
 * capacity — mirroring what Excel's own AutoFit does.
 */
export function calculateSheetData<V>(
  tree: Tree<V>,
  {
    cellMinWidth = 10,
    cellMinHeight = LINE_HEIGHT,
  }: CalculateSheetDataOptions = {}
) {
  const width = tree.width;
  const height = tree.height;
  // Content length candidates per column (from single-row cells)
  const widthCandidates: number[][] = array(width, () => []);
  const sheetCells: SheetCell[] = [];
  const entries: { cell: SheetCell; x: number; y: number; length: number }[] =
    [];

  for (const { node, x, y, width: w, height: h } of cells(tree)) {
    const length = contentLength(node.value);
    const cell: SheetCell = {
      height: h,
      width: w,
      type: node.type,
      value: { value: node.value as LeafValue<V> & JSONPrimitive, col: x + 1, row: y + 1 },
    };
    entries.push({ cell, x, y, length });
    if (h === 1) {
      const perColumn = length / w;
      for (let j = x; j < x + w; j++) {
        widthCandidates[j]!.push(perColumn);
      }
    }
    sheetCells.push(cell);
  }

  // Excel's width unit includes ~1 char of internal cell padding, so size
  // columns one character wider than the content to avoid needless wrapping
  const widths = array(width, (j) =>
    Math.max(
      Math.ceil(percentile(widthCandidates[j]!, 0.9)) + 1,
      cellMinWidth
    )
  );

  // Required line count per physical row (from all cells overlapping it)
  const rowLines: number[] = array(height, () => 1);
  for (const { cell, x, y, length } of entries) {
    if (length === 0) continue;
    let capacity = 0;
    for (let j = x; j < x + cell.width; j++) capacity += widths[j]!;
    const lines = Math.ceil(length / capacity);
    const perRow = Math.ceil(lines / cell.height);
    for (let i = y; i < y + cell.height; i++) {
      rowLines[i] = Math.max(rowLines[i]!, perRow);
    }
  }

  return {
    widths,
    heights: rowLines.map((lines) =>
      Math.max(lines * LINE_HEIGHT, cellMinHeight)
    ),
    cells: sheetCells,
  };
}

export interface RenderOptions extends CalculateSheetDataOptions {}

/**
 * Render a table onto a worksheet.
 *
 * Rows/columns are 1-based and sized according to {@link calculateSheetData};
 * cells spanning more than one row/column are merged.
 */
export function renderOnWorksheet<V>(
  ws: Worksheet,
  wb: Workbook,
  tree: Tree<V>,
  options: RenderOptions = {}
) {
  const { heights, widths, cells: sheetCells } = calculateSheetData(tree, options);
  setColumnWidths(ws, widths, 1);
  setRowHeights(ws, heights, 1);
  const bold = makeFont({ bold: true });
  const alignment = makeAlignment({ vertical: "center", wrapText: true });
  for (const { height, width, type, value } of sheetCells) {
    const { col, row, value: v } = value;
    const cell = setCell(ws, row, col, v);
    setCellStyle(wb, cell, {
      alignment,
      ...(type !== "leaf" ? { font: bold } : {}),
    });
    if (height > 1 || width > 1) {
      mergeCells(ws, {
        minRow: row,
        minCol: col,
        maxRow: row + height - 1,
        maxCol: col + width - 1,
      });
    }
  }
}

export type TableEntry<V> = [title: string, tree: Tree<V>];

/** Create a workbook with one worksheet per entry */
export function treesToWorkbook<V>(
  tables: TableEntry<V>[],
  options: RenderOptions = {}
): Workbook {
  const wb = createWorkbook();
  for (const [title, tree] of tables) {
    renderOnWorksheet(addWorksheet(wb, title), wb, tree, options);
  }
  return wb;
}

/** Serialize tables to xlsx bytes (browser-safe) */
export function treesToXlsxBytes<V>(
  tables: TableEntry<V>[],
  options: RenderOptions = {}
): Promise<Uint8Array> {
  return workbookToBytes(treesToWorkbook(tables, options));
}
