import { max } from "../lib/math.js";

export interface Sized {
  height: number;
  width: number;
}

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

export interface Cell<V> extends Sized {
  node: Extract<Node<V>, { value: any }>;
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
): Generator<Cell<LeafValue<V>>> {
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

    case "row": {
      let col = startCol;
      for (const child of node.children) {
        yield* cells(child, startRow, col, child.width, allocHeight);
        col += child.width;
      }
      return;
    }

    case "col": {
      let row = startRow;
      for (const child of node.children) {
        yield* cells(child, row, startCol, allocWidth, child.height);
        row += child.height;
      }
      return;
    }
    default:
      throw neverError(node, "unexpected node type");
  }
}

type OptionalNode<V> = LeafNode<V> | TreeNode<OptionalNode<V>> | undefined;

type OptionalTree<V> = OptionalNode<LeafValue<V>>;

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

function extractComponentTree<V>(
  tree: Tree<V>,
  kind: "header" | "index",
): OptionalTree<V> {
  if (tree.type === kind) {
    return tree;
  }
  if ("value" in tree) {
    return undefined;
  }
  let isUndefined = true;
  const children = tree.children.map((c) => {
    const t = extractComponentTree(c, kind);
    isUndefined &&= t === undefined;
    return t;
  });
  if (isUndefined) {
    return undefined;
  }
  return {
    ...tree,
    children,
  };
}

export function extractHeadersTree<V>(tree: Tree<V>): OptionalTree<V> {
  return extractComponentTree(tree, "header");
}

export function extractIndexesTree<V>(tree: Tree<V>): OptionalTree<V> {
  return extractComponentTree(tree, "index");
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
  kind: "header" | "index",
): Tree<V> {
  if (
    mask === undefined ||
    tree.type !== mask.type ||
    !("children" in tree) ||
    !("children" in mask)
  ) {
    return tree;
  }
  let maxDim = 1;
  let dimSum = 0;
  const isRow = tree.type === "row";
  const children: Tree<V>[] = [];
  const tc = tree.children;
  for (let i = 0; i < tc.length; i++) {
    const m = mask.children[i];
    if (m?.type === kind) {
      continue;
    }
    const child = decapitateTree(tc[i]!, m, kind);
    maxDim = max(maxDim, isRow ? child.height : child.width);
    dimSum += isRow ? child.width : child.height;
    children.push(child);
  }
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
