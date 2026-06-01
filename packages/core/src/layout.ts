import { makeProportionalResizeGuard } from "./json-to-table/proportional-resize-guard.js";
import { makeObjectPropertiesStabilizer } from "./json-to-table/properties-stabilizer.js";
import { isJsonPrimitive } from "./lib/json.js";
import { lcm, max } from "./lib/math.js";
import { isObject, isPlainObject, isRecordProto } from "./lib/object.js";

interface Sized {
  height: number;
  width: number;
}

interface LeafNode<V> extends Sized {
  type: "leaf" | "header" | "index";
  value: V;
}

interface TreeNode<C> extends Sized {
  type: "row" | "col";
  children: C[];
}

type Node<V> = LeafNode<V> | TreeNode<Node<V>>;

export type LeafValue<V> = Exclude<
  V,
  Record<PropertyKey, unknown> | Array<any>
>;

export type Tree<V> = Node<LeafValue<V>>;

export interface TreeFactoryOptions<V> {
  cornerCellValue: LeafValue<V>;
  createHeader: (k: string, record: Record<PropertyKey, V>) => LeafValue<V>;
  createIndex: (i: number, array: V[]) => LeafValue<V>;
  joinPrimitiveArrayValues?: boolean;
  /** combine arrays of objects into a single object */
  combineArraysOfObjects?: boolean;
  /** proportional size adjustment threshold */
  proportionalSizeAdjustmentThreshold?: number;
  collapseIndexes?: boolean;
  stabilizeOrderOfPropertiesInArraysOfObjects?: boolean;
}

export function makeTreeFactory<V>({
  cornerCellValue,
  createHeader,
  createIndex,
  joinPrimitiveArrayValues,
  combineArraysOfObjects,
  proportionalSizeAdjustmentThreshold = 1,
  collapseIndexes,
  stabilizeOrderOfPropertiesInArraysOfObjects = true,
}: TreeFactoryOptions<V>) {
  const isProportionalResize = makeProportionalResizeGuard(
    proportionalSizeAdjustmentThreshold,
  );

  function isProportionalSize(
    trees: Tree<V>[],
    dim: keyof Sized,
  ): boolean {
    let maxSize = 1;
    let lcmSize = 1;
    for (const tree of trees) {
      maxSize = max(maxSize, tree[dim]);
      lcmSize = lcm(lcmSize, tree[dim]);
    }
    return isProportionalResize(lcmSize, maxSize);
  }

  function makeLeaf(value: LeafValue<V>): Tree<V> {
    return {
      type: "leaf",
      value,
      width: 1,
      height: 1,
    };
  }

  function makeRow(children: Tree<V>[]): Tree<V> {
    const normalized = children.flatMap((child) =>
      child.type === "row" ? child.children : [child],
    );
    if (normalized.length === 0) {
      return makeLeaf(cornerCellValue);
    }
    if (normalized.length === 1) {
      return normalized[0]!;
    }
    return {
      type: "row",
      height: normalized.reduce((h, child) => max(h, child.height), 1),
      width: normalized.reduce((w, child) => w + child.width, 0),
      children: normalized,
    };
  }

  function makeCol(children: Tree<V>[]): Tree<V> {
    const normalized = children.flatMap((child) =>
      child.type === "col" ? child.children : [child],
    );
    if (normalized.length === 0) {
      return makeLeaf(cornerCellValue);
    }
    if (normalized.length === 1) {
      return normalized[0]!;
    }
    return {
      type: "col",
      height: normalized.reduce((h, child) => h + child.height, 0),
      width: normalized.reduce((w, child) => max(w, child.width), 1),
      children: normalized,
    };
  }

  function liftSharedHeaders(children: Tree<V>[]): Tree<V>[] {
    if (children.length < 2) {
      return children;
    }
    const headers = children.map(extractHeadersTree);
    const headerTrees = headers.filter((tree) => tree !== undefined);
    if (!isProportionalSize(headerTrees as Tree<V>[], "width")) {
      return children;
    }
    let sharedHeaders = extractHeadersTree(children[0]!);
    if (sharedHeaders === undefined) {
      return children;
    }
    for (let i = 1; i < children.length; i++) {
      sharedHeaders = extractSubtree(children[i]!, sharedHeaders);
      if (sharedHeaders === undefined) {
        return children;
      }
    }
    const rows = children.map((child) => decapitateTree(child, sharedHeaders));
    stretchOptionalLeavesDimensionInPlace(
      sharedHeaders,
      "width",
      makeRow(rows).width,
    );
    const head = materializeOptionalTree(children[0]!, sharedHeaders);
    return [head, makeCol(rows)];
  }

  function liftSharedIndexes(children: Tree<V>[]): Tree<V>[] {
    if (children.length < 2) {
      return children;
    }
    const indexes = children.map(extractIndexesTree);
    const indexTrees = indexes.filter((tree) => tree !== undefined);
    if (!isProportionalSize(indexTrees as Tree<V>[], "height")) {
      return children;
    }
    let sharedIndexes = extractIndexesTree(children[0]!);
    if (sharedIndexes === undefined) {
      return children;
    }
    for (let i = 1; i < children.length; i++) {
      sharedIndexes = extractSubtree(children[i]!, sharedIndexes);
      if (sharedIndexes === undefined) {
        return children;
      }
    }
    const columns = children.map((child) => decapitateTree(child, sharedIndexes));
    stretchOptionalLeavesDimensionInPlace(
      sharedIndexes,
      "height",
      makeCol(columns).height,
    );
    const indexTree = materializeOptionalTree(children[0]!, sharedIndexes);
    return [indexTree, makeRow(columns)];
  }

  function materializeOptionalTree(
    source: Tree<V>,
    tree: OptionalTree<V>,
  ): Tree<V> {
    if (tree === undefined) {
      return {
        type: "leaf",
        value: cornerCellValue,
        height: source.height,
        width: source.width,
      };
    }
    if (!("children" in tree)) {
      return tree;
    }
    return {
      ...tree,
      children: tree.children.map((child, i) =>
        materializeOptionalTree(
          "children" in source ? source.children[i]! : source,
          child,
        ),
      ),
    };
  }

  function prependIndexPrefix(tree: Tree<V>, prefix: string): Tree<V> | null {
    if (tree.type === "index") {
      return {
        ...tree,
        value: `${prefix}.${tree.value}` as LeafValue<V>,
      };
    }
    if (!("children" in tree)) {
      return null;
    }
    let hasIndex = false;
    const children = tree.children.map((child) => {
      const prefixed = prependIndexPrefix(child, prefix);
      hasIndex ||= prefixed !== null;
      return prefixed ?? child;
    });
    return hasIndex ? { ...tree, children } : null;
  }

  function transformRecord(value: Record<PropertyKey, V>): Tree<V> {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return makeLeaf(cornerCellValue);
    }
    const columns = entries.map(([k, v]) => {
      const child = transformValue(v);
      return makeCol([
          {
            type: "header",
            value: createHeader(k, value),
            height: 1,
            width: child.width,
          },
          child,
        ]);
    });
    return makeRow(liftSharedIndexes(columns));
  }

  function transformArray(
    value: V[],
    transformValue: (value: V) => Tree<V>,
    indexPrefix?: string,
  ): Tree<V> {
    if (value.length === 0) {
      return makeLeaf(cornerCellValue);
    }
    const rows = value.map((v, i) => {
      const child = transformValue(v);
      const indexValue = createIndex(i, value);
      const indexLabel = indexPrefix
        ? (`${indexPrefix}.${indexValue}` as LeafValue<V>)
        : indexValue;
      if (collapseIndexes) {
        const prefixedChild = prependIndexPrefix(child, String(indexLabel));
        if (prefixedChild !== null) {
          return prefixedChild;
        }
      }
      return makeRow([
          {
            type: "index",
            value: indexLabel,
            width: 1,
            height: child.height,
          },
          child,
        ]);
    });
    return makeCol(liftSharedHeaders(rows));
  }

  function transformValue(value: V): Tree<V> {
    if (isObject(value)) {
      if (isRecordProto(value)) {
        return transformRecord(value as Record<PropertyKey, V>);
      }
      if (Array.isArray(value)) {
        if (joinPrimitiveArrayValues && value.every(isJsonPrimitive)) {
          return makeLeaf(value.join(", ") as LeafValue<V>);
        }
        if (combineArraysOfObjects && value.every(isPlainObject)) {
          return transformRecord(Object.assign({}, ...value));
        }
        if (
          stabilizeOrderOfPropertiesInArraysOfObjects &&
          value.every(isPlainObject)
        ) {
          const stabilize = makeObjectPropertiesStabilizer<V>();
          return transformArray(value, (value) => {
            const [keys, values] = stabilize(
              value as Record<string, V>,
            );
            if (keys.length === 0) {
              return makeLeaf(cornerCellValue);
            }
            return makeRow(
              keys.map((key, i) => {
                const child = transformValue(values[i]!);
                return makeCol([
                  {
                    type: "header",
                    value: createHeader(key, value as Record<PropertyKey, V>),
                    height: 1,
                    width: child.width,
                  },
                  child,
                ]);
              }),
            );
          });
        }
        return transformArray(value, transformValue);
      }
    }
    return makeLeaf(value as LeafValue<V>);
  }

  return transformValue;
}

interface Cell<V> extends Sized {
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

export function extractHeadersTree<V>(tree: Tree<V>): OptionalTree<V> {
  if (tree.type === "header") {
    return tree;
  }
  if ("value" in tree) {
    return undefined;
  }
  let isUndefined = true;
  const children = tree.children.map((c) => {
    const t = extractHeadersTree(c);
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

export function extractIndexesTree<V>(tree: Tree<V>): OptionalTree<V> {
  if (tree.type === "index") {
    return tree;
  }
  if ("value" in tree) {
    return undefined;
  }
  let isUndefined = true;
  const children = tree.children.map((c) => {
    const t = extractIndexesTree(c);
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
    if (m?.type === "header") {
      continue;
    }
    const child = decapitateTree(tc[i]!, m);
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

function stretchOptionalLeavesDimensionInPlace<V>(
  tree: OptionalTree<V>,
  dim: keyof Sized,
  allocated: number,
): void {
  if (tree === undefined) {
    return;
  }
  tree[dim] = allocated;

  if (!("children" in tree)) {
    return;
  }

  const sequential =
    (dim === "height" && tree.type === "col") ||
    (dim === "width" && tree.type === "row");

  if (!sequential) {
    for (const child of tree.children) {
      stretchOptionalLeavesDimensionInPlace(child, dim, allocated);
    }
    return;
  }

  let remaining = allocated;
  let lastDefined = -1;
  for (let i = 0; i < tree.children.length; i++) {
    if (tree.children[i] !== undefined) {
      lastDefined = i;
    }
  }

  for (let i = 0; i < lastDefined; i++) {
    const child = tree.children[i];
    if (child === undefined) {
      continue;
    }
    stretchOptionalLeavesDimensionInPlace(child, dim, child[dim]);
    remaining -= child[dim];
  }

  if (lastDefined >= 0) {
    stretchOptionalLeavesDimensionInPlace(
      tree.children[lastDefined],
      dim,
      remaining,
    );
  }
}
