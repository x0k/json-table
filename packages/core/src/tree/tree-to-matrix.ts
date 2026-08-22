import { type Cell, CellType } from "../json-table.js";
import { type Matrix, matrix } from "../lib/matrix.js";

import { cells, type LeafValue, type Tree } from "./tree.js";

const CELL_TYPES = {
  leaf: CellType.Value,
  header: CellType.Header,
  index: CellType.Index,
  corner: CellType.Corner,
} as const;

export function treeToMatrix<V>(tree: Tree<V>): Matrix<Cell<LeafValue<V>>> {
  const m = matrix<Cell<LeafValue<V>> | undefined>(
    tree.height,
    tree.width,
    () => undefined,
  );
  for (const { node, x, y, width, height } of cells(tree)) {
    const cell: Cell<LeafValue<V>> = {
      value: node.value,
      type: CELL_TYPES[node.type],
      height,
      width,
    };
    for (let i = y; i < y + height; i++) {
      for (let j = x; j < x + width; j++) {
        if (m[i]![j] !== undefined) {
          throw new Error(
            `cell overlap at [${i}][${j}], tree sizes are inconsistent`,
          );
        }
        m[i]![j] = cell;
      }
    }
  }
  for (let i = 0; i < tree.height; i++) {
    for (let j = 0; j < tree.width; j++) {
      if (m[i]![j] === undefined) {
        throw new Error(
          `uncovered position at [${i}][${j}], tree cannot be materialized into a dense matrix`,
        );
      }
    }
  }
  // the coverage loop above guarantees density
  return m as Matrix<Cell<LeafValue<V>>>;
}
