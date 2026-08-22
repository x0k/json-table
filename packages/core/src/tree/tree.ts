import type { Sized } from "../json-table.js";
import { max } from "../lib/math.js";

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

export type OptionalNode<V> =
  | LeafNode<V>
  | TreeNode<OptionalNode<V>>
  | undefined;

export type OptionalTree<V> = OptionalNode<LeafValue<V>>;

export function isTreeStructurallyEquals<V>(
  a: OptionalTree<V>,
  b: OptionalTree<V>,
): boolean {
  if (a === b) {
    return true;
  }
  if (a === undefined || b === undefined || a.type !== b.type) {
    return false;
  }
  if ("children" in a && "children" in b) {
    return (
      a.children.length === b.children.length &&
      a.children.every((c, i) => isTreeStructurallyEquals(c, b.children[i]))
    );
  }
  return "value" in a && "value" in b && a.value === b.value;
}

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
  let isUndefined = true;
  const children = tree.children.map((c) => {
    const r = extractComponentTree(c, kinds);
    isUndefined &&= r === undefined;
    return r;
  });
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

export function extractHeadersTree<V>(tree: Tree<V>): OptionalTree<V> {
  return extractComponentTree(tree, HEAD_KINDS);
}

export function extractSubtree<V>(
  tree: Tree<V>,
  mask: OptionalTree<V>,
): OptionalTree<V> {
  if (mask === undefined || tree.type !== mask.type) {
    return undefined;
  }
  if ("children" in tree && "children" in mask) {
    let children = mask.children;
    if (tree.children.length !== children.length) {
      return undefined;
    }
    let isUndefined = true;
    children = tree.children.map((c, i) => {
      const child = extractSubtree(c, mask.children[i]);
      isUndefined &&= child === undefined;
      return child;
    });
    return isUndefined
      ? undefined
      : {
          ...tree,
          children,
        };
  }
  return "value" in tree && "value" in mask && tree.value === mask.value
    ? tree
    : undefined;
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
  const isRow = tree.type === "row";
  const children: Tree<V>[] = [];
  const tc = tree.children;
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
    children.push(child);
  }
  // a row of nothing but corners has no remaining content
  if (children.length > 0 && children.every((c) => c.type === "corner")) {
    return { ...tree, width: 0, height: 0 };
  }
  for (const child of children) {
    if (child.type !== "corner") {
      contentMax = max(contentMax, isRow ? child.height : child.width);
    }
  }
  // surviving corners span exactly their remaining content region
  for (const child of children) {
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
  if (children.length === 1) {
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
