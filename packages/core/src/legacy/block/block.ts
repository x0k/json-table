import { lcm, max } from "../lib/math.js";
import { array } from "../lib/array.js";

import type {
  Block,
  BlockCompositor,
  BlockSizeAspect,
  Cell,
  ProportionalResizeGuard,
  Cells,
  RowsScaler,
  Rows,
  BlockTransformInPlace,
} from "../json-table.js";

import {
  scaleRowsHorizontallyInPlace,
  scaleRowsVerticallyInPlace,
} from "./row.js";

export interface AreBlocksEqualOptions<V> {
  blocks: Block<V>[];
  width: number;
  height: number;
  widthIsLcm?: boolean;
  heightIsLcm?: boolean;
}

export function areBlocksEqual<V>({
  blocks,
  width,
  heightIsLcm = true,
  height,
  widthIsLcm = true,
}: AreBlocksEqualOptions<V>): boolean {
  const blocksRows = blocks.map((b) => {
    const wMultiplier = widthIsLcm ? width / b.width : 1;
    const hMultiplier = heightIsLcm ? height / b.height : 1;
    const { rows, indexes } = b.data;
    const newRows = array(height, () => new Array<Cell<V>>(width));
    for (let i = 0; i < rows.length; i++) {
      const index = indexes[i]!;
      const { cells, columns } = rows[i]!;
      for (let j = 0; j < cells.length; j++) {
        const cell = cells[j]!;
        const row = index * hMultiplier;
        let rowEnd = row + cell.height * hMultiplier;
        if (!heightIsLcm && rowEnd === b.height && rowEnd < height) {
          rowEnd = height;
        }
        const col = columns[j]! * wMultiplier;
        let colEnd = col + cell.width * wMultiplier;
        if (!widthIsLcm && colEnd === b.width && colEnd < width) {
          colEnd = width;
        }
        for (let k = row; k < rowEnd; k++) {
          const newRow = newRows[k]!;
          for (let l = col; l < colEnd; l++) {
            newRow[l] = cell;
          }
        }
      }
    }
    return newRows;
  });
  // Loop over rows
  for (let i = 0; i < height; i++) {
    const firstBlockRow = blocksRows[0]![i]!;
    // Loop over cells
    for (let j = 0; j < width; j++) {
      const firstBlockCell = firstBlockRow[j]!;
      // Loop over other blocks
      for (let k = 1; k < blocks.length; k++) {
        const cell = blocksRows[k]![i]![j];
        if (!cell || firstBlockCell.value !== cell.value) {
          return false;
        }
      }
    }
    i++;
  }
  return true;
}

function applyResizeInPlace<V>(
  { rows }: Rows<V>,
  toResize: Map<number, Map<number, number>>,
  sizeAspect: BlockSizeAspect
): void {
  for (const [rowId, cells] of toResize) {
    const rowCells = rows[rowId]!.cells;
    for (const [cellId, diff] of cells) {
      rowCells[cellId]![sizeAspect] += diff;
    }
  }
}

export function stretchCellsToBottomInPlace<V>({
  data,
  height,
  width,
}: Block<V>): void {
  // TODO: Calculate yShift by row index and cell height
  const yShift = array(width, () => 0);
  const bottomPositions = new Array<
    | {
        cell: Cell<V>;
        rowIndex: number;
        colIndex: number;
      }
    | null
    | undefined
  >(width);
  const { rows } = data;
  for (let i = 0; i < rows.length; i++) {
    const { cells, columns } = rows[i]!;
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j]!;
      const x = columns[j]!;
      yShift[x]! += cell.height;
      bottomPositions[x] = { cell, rowIndex: i, colIndex: j };
      for (let k = 1; k < cell.width; k++) {
        yShift[x + k]! += cell.height;
        bottomPositions[x + k] = null;
      }
    }
  }
  // rowId: { cellId: diff }
  const toResize = new Map<number, Map<number, number>>();
  for (let i = 0; i < width; i++) {
    const position = bottomPositions[i];
    if (!position) {
      continue;
    }
    const diff = height - yShift[i]!;
    if (diff <= 0) {
      continue;
    }
    const cells = toResize.get(position.rowIndex) || new Map<number, number>();
    toResize.set(position.rowIndex, cells.set(position.colIndex, diff));
  }
  applyResizeInPlace(data, toResize, "height");
}

export function stretchCellsToRightInPlace<V>({
  data,
  height,
  width,
}: Block<V>) {
  const rightPositions = new Array<
    | {
        cell: Cell<V>;
        indexInRow: number;
        xTopRightCorner: number;
      }
    | undefined
  >(height);
  const { rows, indexes } = data;
  for (let i = 0; i < rows.length; i++) {
    const { cells, columns } = rows[i]!;
    if (cells.length === 0) {
      continue;
    }
    const indexInRow = cells.length - 1;
    const cell = cells[indexInRow]!;
    const xTopRightCorner = columns[indexInRow]! + cell.width;
    const point = {
      cell,
      indexInRow,
      xTopRightCorner,
    };
    const index = indexes[i]!;
    for (let j = index; j < index + cell.height; j++) {
      const rp = rightPositions[j];
      if (!rp || xTopRightCorner > rp.xTopRightCorner) {
        rightPositions[j] = point;
      }
    }
  }
  // TODO: this algorithm can be implemented without `set` of cells
  const addedToResize = new Set<Cell<V>>();
  const toResize = new Map<number, Map<number, number>>();
  for (let i = 0; i < rows.length; i++) {
    const index = indexes[i]!;
    const position = rightPositions[index];
    if (!position || addedToResize.has(position.cell)) {
      continue;
    }
    addedToResize.add(position.cell);
    const diff = width - position.xTopRightCorner;
    if (diff <= 0) {
      continue;
    }
    const cells = toResize.get(i) || new Map<number, number>();
    toResize.set(i, cells.set(position.indexInRow, diff));
  }
  applyResizeInPlace(data, toResize, "width");
}

const SIZE_ASPECT_TO_ROWS_IN_PLACE_SCALER: Record<
  BlockSizeAspect,
  RowsScaler<any>
> = {
  width: scaleRowsHorizontallyInPlace,
  height: scaleRowsVerticallyInPlace,
};

const SIZE_ASPECT_TO_CELLS_IN_PLACE_STRETCHER: Record<
  BlockSizeAspect,
  BlockTransformInPlace<any>
> = {
  width: stretchCellsToRightInPlace,
  height: stretchCellsToBottomInPlace,
};

export function makeBlockInPlaceScaler<V>(
  sizeAspect: BlockSizeAspect,
  finalSize: number
): BlockTransformInPlace<V> {
  const scaleRowsInPlace = SIZE_ASPECT_TO_ROWS_IN_PLACE_SCALER[sizeAspect];
  const stretchCellsInPlace =
    SIZE_ASPECT_TO_CELLS_IN_PLACE_STRETCHER[sizeAspect];
  return (table) => {
    const multiplier = Math.floor(finalSize / table[sizeAspect]);
    if (multiplier > 1) {
      scaleRowsInPlace(table.data, multiplier);
    }
    let oldSize = table[sizeAspect];
    table[sizeAspect] = finalSize;
    if (finalSize - oldSize * multiplier > 0) {
      stretchCellsInPlace(table);
    }
  };
}

export function mergeBlocksVertically<V>(
  blocks: Block<V>[],
  width: number
): Block<V> {
  // TODO: first block can be used as accumulator
  const rows = new Array<Cells<V>>(0);
  const indexes = new Array<number>(0);
  let index = 0;
  for (let i = 0; i < blocks.length; i++) {
    const { data, height } = blocks[i]!;
    for (let j = 0; j < data.rows.length; j++) {
      indexes.push(index + data.indexes[j]!);
      rows.push(data.rows[j]!);
    }
    index += height;
  }
  return {
    width,
    height: index,
    data: { rows, indexes },
  };
}

export function compressRawRowsInPlaceAndMakeIndexes<V>(
  rows: Cells<V>[]
): number[] {
  const indexes = new Array<number>(rows.length);
  let shift = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.cells.length === 0) {
      shift++;
      continue;
    }
    rows[i - shift] = rows[i]!;
    indexes[i - shift] = i;
  }
  rows.length -= shift;
  indexes.length -= shift;
  return indexes;
}

export function mergeBlocksHorizontally<V>(
  blocks: Block<V>[],
  height: number
): Block<V> {
  const newRows = array(height, (): Cells<V> => ({ cells: [], columns: [] }));
  let width = 0;
  for (let i = 0; i < blocks.length; i++) {
    const {
      data: { rows, indexes },
      width: blockWidth,
    } = blocks[i]!;
    for (let j = 0; j < rows.length; j++) {
      const { cells, columns } = rows[j]!;
      const row = newRows[indexes[j]!]!;
      for (let k = 0; k < cells.length; k++) {
        row.cells.push(cells[k]!);
        row.columns.push(columns[k]! + width);
      }
    }
    width += blockWidth;
  }
  // Rows created locally, so no mutations
  const indexes = compressRawRowsInPlaceAndMakeIndexes(newRows);
  return {
    width,
    height,
    data: {
      rows: newRows,
      indexes,
    },
  };
}

// TODO: combine into one function `makeBlockStacker`
export function makeVerticalBlockInPlaceStacker<V>(
  isProportionalResize: ProportionalResizeGuard
): BlockCompositor<V> {
  return function stackBlocksVertically(blocks) {
    let lcmWidth = blocks[0]!.width;
    let maxWidth = lcmWidth;
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i]!;
      lcmWidth = lcm(lcmWidth, block.width);
      maxWidth = max(maxWidth, block.width);
    }
    const width = isProportionalResize(lcmWidth, maxWidth)
      ? lcmWidth
      : maxWidth;
    const scale = makeBlockInPlaceScaler<V>("width", width);
    for (let i = 0; i < blocks.length; i++) {
      scale(blocks[i]!);
    }
    return mergeBlocksVertically(blocks, width);
  };
}
export function makeHorizontalBlockInPlaceStacker<V>(
  isProportionalResize: ProportionalResizeGuard
): BlockCompositor<V> {
  return (blocks) => {
    let lcmHeight = blocks[0]!.height;
    let maxHeight = lcmHeight;
    for (let i = 1; i < blocks.length; i++) {
      lcmHeight = lcm(lcmHeight, blocks[i]!.height);
      maxHeight = max(maxHeight, blocks[i]!.height);
    }
    const height = isProportionalResize(lcmHeight, maxHeight)
      ? lcmHeight
      : maxHeight;
    const scale = makeBlockInPlaceScaler<V>("height", height);
    for (let i = 0; i < blocks.length; i++) {
      scale(blocks[i]!);
    }
    return mergeBlocksHorizontally(blocks, height);
  };
}
