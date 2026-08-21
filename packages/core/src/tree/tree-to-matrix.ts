import { type Cell, CellType } from "../json-table.js";
import { type Matrix, matrix } from "../lib/matrix.js";

import {
  cells,
  stretchLeavesDimensionInPlace,
  type LeafValue,
  type Tree,
} from "./tree.js";

const CELL_TYPES = {
  leaf: CellType.Value,
  header: CellType.Header,
  index: CellType.Index,
} as const;

function cloneTree<V>(tree: Tree<V>): Tree<V> {
  if (!("children" in tree)) {
    return { ...tree };
  }
  return { ...tree, children: tree.children.map(cloneTree) };
}

export function treeToMatrix<V>(tree: Tree<V>): Matrix<Cell<LeafValue<V>>> {
  const prepared = cloneTree(tree);
  stretchLeavesDimensionInPlace(prepared, "height");
  stretchLeavesDimensionInPlace(prepared, "width");
  const m = matrix<Cell<LeafValue<V>> | undefined>(
    prepared.height,
    prepared.width,
    () => undefined,
  );
  for (const { node, x, y, width, height } of cells(prepared)) {
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
  for (let i = 0; i < prepared.height; i++) {
    for (let j = 0; j < prepared.width; j++) {
      if (m[i]![j] === undefined) {
        throw new Error(
          `uncovered position at [${i}][${j}], tree cannot be materialized into a dense matrix`,
        );
      }
    }
  }
  return m as Matrix<Cell<LeafValue<V>>>;
}
