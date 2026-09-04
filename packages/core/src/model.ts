export interface Height {
  height: number;
}

export interface Width {
  width: number;
}

export interface Sized extends Height, Width {}

/** protocol symbol: an object may expose a function under this key that
 * returns its prebuilt `Tree` representation, bypassing default parsing */
export const TO_TABLE = Symbol("TO_TABLE");

import { array } from "./lib/array.js";
import { max } from "./lib/math.js";

export interface LeafNode<V> extends Sized {
  type: "leaf" | "header" | "index" | "corner";
  value: V;
}

export interface TreeNode<C> extends Sized {
  type: "row" | "col";
  children: C[];
}

export type Node<V> = LeafNode<V> | TreeNode<Node<V>>;

export type LeafValue<V> = Exclude<
  V,
  Record<PropertyKey, unknown> | Array<any>
>;

export type Tree<V> = Node<LeafValue<V>>;

/** a leaf node placed at its materialized matrix position */
export interface TreeCell<V> extends Sized {
  node: LeafNode<V>;
  y: number;
  x: number;
}

function neverError(value: never, message: string) {
  return new Error(`${message}: ${value}`);
}

export function* cells<V>(
  node: Tree<V>,
  startRow = 0,
  startCol = 0,
  allocWidth = node.width,
  allocHeight = node.height,
): Generator<TreeCell<LeafValue<V>>> {
  switch (node.type) {
    case "leaf":
    case "header":
    case "index":
    case "corner":
      yield {
        node,
        x: startCol,
        y: startRow,
        width: allocWidth,
        height: allocHeight,
      };
      return;

    // along the container's direction earlier children keep their own
    // extent while the last one absorbs whatever remains of the
    // allocated span; across it every child receives the full span
    case "row": {
      let col = startCol;
      const last = node.children.length - 1;
      for (let i = 0; i < last; i++) {
        const child = node.children[i]!;
        yield* cells(child, startRow, col, child.width, allocHeight);
        col += child.width;
      }
      if (last >= 0) {
        yield* cells(
          node.children[last]!,
          startRow,
          col,
          allocWidth - (col - startCol),
          allocHeight,
        );
      }
      return;
    }

    case "col": {
      let row = startRow;
      const last = node.children.length - 1;
      for (let i = 0; i < last; i++) {
        const child = node.children[i]!;
        yield* cells(child, row, startCol, allocWidth, child.height);
        row += child.height;
      }
      if (last >= 0) {
        yield* cells(
          node.children[last]!,
          row,
          startCol,
          allocWidth,
          allocHeight - (row - startRow),
        );
      }
      return;
    }
    default:
      throw neverError(node, "unexpected node type");
  }
}

/** groups cells into visual rows: exactly `tree.height` arrays (rows fully
 * covered by rowspans are present but empty), each holding the cells that
 * start in it in ascending x order — a property of the `cells()` traversal
 * for layout-consistent trees */
export function rows<V>(
  tree: Tree<V>,
): TreeCell<LeafValue<V>>[][] {
  const result = array<TreeCell<LeafValue<V>>[]>(tree.height, () => []);
  for (const cell of cells(tree)) {
    result[cell.y]!.push(cell);
  }
  return result;
}

export type OptionalNode<V> =
  | LeafNode<V>
  | TreeNode<OptionalNode<V>>
  | undefined;

export type OptionalTree<V> = OptionalNode<LeafValue<V>>;

export type ComponentKind = "header" | "index" | "corner";

/** every possible node discriminant, including `"leaf"`; kind sets used for
 * stripping may only ever name component kinds, but membership is always
 * tested against leaf node discriminants */
export type NodeKind = LeafNode<never>["type"];

export function extractComponentTree<V>(
  tree: Tree<V>,
  kinds: ReadonlySet<NodeKind>,
): OptionalTree<V> {
  if ("value" in tree) {
    return kinds.has(tree.type) ? tree : undefined;
  }
  const children: OptionalTree<V>[] = new Array(tree.children.length);
  let isUndefined = true;
  for (let i = 0; i < tree.children.length; i++) {
    const r = extractComponentTree(tree.children[i]!, kinds);
    children[i] = r;
    isUndefined &&= r === undefined;
  }
  if (isUndefined) {
    return undefined;
  }
  return {
    ...tree,
    children,
  };
}

export const HEAD_KINDS: ReadonlySet<ComponentKind> = new Set(["header"]);
export const INDEX_KINDS: ReadonlySet<ComponentKind> = new Set(["index"]);

/** structural intersection: keeps the parts of `tree` matching the mask's
 * shape and values, yielding `undefined` holes elsewhere */
export function intersectTrees<V>(
  tree: Tree<V>,
  mask: OptionalTree<V>,
  isHeaderEqual: (a: LeafValue<V>, b: LeafValue<V>) => boolean,
): OptionalTree<V> {
  if (mask === undefined || tree.type !== mask.type) {
    return undefined;
  }
  if ("children" in tree && "children" in mask) {
    const maskChildren = mask.children;
    if (tree.children.length !== maskChildren.length) {
      return undefined;
    }
    const children: OptionalTree<V>[] = new Array(tree.children.length);
    let isUndefined = true;
    for (let i = 0; i < tree.children.length; i++) {
      const child = intersectTrees(
        tree.children[i]!,
        maskChildren[i],
        isHeaderEqual,
      );
      children[i] = child;
      isUndefined &&= child === undefined;
    }
    return isUndefined
      ? undefined
      : {
          ...tree,
          children,
        };
  }
  if ("value" in tree && "value" in mask) {
    // Both are leaves of the same kind here (types were forced equal
    // above). Custom equality applies to band cells only; index and data
    // leaves always compare strictly so distinct rows can never merge.
    const equal =
      tree.type === "header" || tree.type === "corner"
        ? isHeaderEqual(tree.value, mask.value)
        : tree.value === mask.value;
    return equal ? tree : undefined;
  }
  return undefined;
}

export function decapitateTree<V>(
  tree: Tree<V>,
  mask: OptionalTree<V>,
  kinds: ReadonlySet<NodeKind>,
): Tree<V> {
  if (
    mask === undefined ||
    tree.type !== mask.type ||
    !("children" in tree) ||
    !("children" in mask)
  ) {
    return tree;
  }
  let dimSum = 0;
  let contentMax = 1;
  let hasNonCorner = false;
  const isRow = tree.type === "row";
  const tc = tree.children;
  const children: Tree<V>[] = new Array(tc.length);
  let count = 0;
  for (let i = 0; i < tc.length; i++) {
    const m = mask.children[i];
    if (m !== undefined && !("children" in m) && kinds.has(m.type)) {
      continue;
    }
    const child = decapitateTree(tc[i]!, m, kinds);
    // containers emptied by stripping and zero-size vanish markers
    if (
      ("children" in child && child.children.length === 0) ||
      (child.width === 0 && child.height === 0)
    ) {
      continue;
    }
    children[count++] = child;
    if (child.type !== "corner") {
      hasNonCorner = true;
      contentMax = max(contentMax, isRow ? child.height : child.width);
    }
  }
  children.length = count;
  // a row of nothing but corners has no remaining content
  if (count > 0 && !hasNonCorner) {
    return { ...tree, width: 0, height: 0 };
  }
  // surviving corners span exactly their remaining content region
  for (let i = 0; i < count; i++) {
    const child = children[i]!;
    if (child.type === "corner") {
      if (isRow) {
        child.height = contentMax;
      } else {
        child.width = contentMax;
      }
    }
    dimSum += isRow ? child.width : child.height;
  }
  const maxDim = contentMax;
  if (count === 1) {
    return children[0]!;
  }
  return {
    ...tree,
    width: isRow ? dimSum : maxDim,
    height: isRow ? maxDim : dimSum,
    children,
  };
}

export function stretchLeavesDimensionInPlace<V>(
  tree: Tree<V>,
  dim: keyof Sized,
  allocated = tree[dim],
): void {
  tree[dim] = allocated;

  if (!("children" in tree)) {
    return;
  }

  const sequential =
    (dim === "height" && tree.type === "col") ||
    (dim === "width" && tree.type === "row");

  if (!sequential) {
    for (const child of tree.children) {
      stretchLeavesDimensionInPlace(child, dim, allocated);
    }
    return;
  }

  let remaining = allocated;
  const last = tree.children.length - 1;

  for (let i = 0; i < last; i++) {
    const child = tree.children[i]!;
    stretchLeavesDimensionInPlace(child, dim, child[dim]);
    remaining -= child[dim];
  }

  if (last >= 0) {
    stretchLeavesDimensionInPlace(tree.children[last]!, dim, remaining);
  }
}

/** recomputes every container extent bottom-up from its actual children:
 * sequential extent becomes the exact sum, cross extent the max. Guarantees
 * the layout invariants that span allocation (and transformations such as
 * transpose) rely on, whatever assumptions construction made */
export function normalizeExtentsInPlace<V>(tree: Tree<V>): void {
  if (!("children" in tree)) {
    return;
  }
  const isRow = tree.type === "row";
  let sequential = 0;
  let cross = 1;
  for (const child of tree.children) {
    normalizeExtentsInPlace(child);
    sequential += isRow ? child.width : child.height;
    cross = max(cross, isRow ? child.height : child.width);
  }
  if (isRow) {
    tree.width = sequential;
    tree.height = cross;
  } else {
    tree.width = cross;
    tree.height = sequential;
  }
}

/** reverses the visual order of columns */
export function horizontalMirrorInPlace<V>(tree: Tree<V>): void {
  if (!("children" in tree)) {
    return;
  }
  for (const child of tree.children) {
    horizontalMirrorInPlace(child);
  }
  if (tree.type === "row") {
    tree.children.reverse();
  }
}

/** reverses the visual order of rows */
export function verticalMirrorInPlace<V>(tree: Tree<V>): void {
  if (!("children" in tree)) {
    return;
  }
  for (const child of tree.children) {
    verticalMirrorInPlace(child);
  }
  if (tree.type === "col") {
    tree.children.reverse();
  }
}

/** reflects the table over its main diagonal: rows become columns and
 * vice versa; extents are swapped on every node, including leaf-typed
 * nodes carrying merged spans */
export function transposeTree<V>(tree: Tree<V>): Tree<V> {
  if (!("children" in tree)) {
    return { ...tree, width: tree.height, height: tree.width };
  }
  return {
    ...tree,
    type: tree.type === "row" ? "col" : "row",
    width: tree.height,
    height: tree.width,
    children: tree.children.map(transposeTree),
  };
}
