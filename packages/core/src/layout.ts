import { makeProportionalResizeGuard } from "./json-to-table/proportional-resize-guard.js";
import { max } from "./lib/math.js";
import { isObject, isRecordProto } from "./lib/object.js";

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
  /** proportional size adjustment threshold */
  proportionalSizeAdjustmentThreshold?: number;
}

export function makeTreeFactory<V>({
  createHeader,
  createIndex,
  proportionalSizeAdjustmentThreshold = 1,
}: TreeFactoryOptions<V>) {
  const isProportionalResize = makeProportionalResizeGuard(
    proportionalSizeAdjustmentThreshold,
  );

  function transformRecord(value: Record<PropertyKey, V>): Tree<V> {
    let maxHeight = 1;
    let widthSum = 0;
    const children: Tree<V>[] = Object.entries(value).map(([k, v]) => {
      const child = transformValue(v);
      const height = child.height + 1;
      maxHeight = max(maxHeight, height);
      widthSum += child.width;
      return {
        type: "col",
        height,
        width: child.width,
        children: [
          {
            type: "header",
            value: createHeader(k, value),
            height: 1,
            width: child.width,
          },
          child,
        ],
      };
    });
    if (children.length === 1) {
      return children[0]!;
    }
    return {
      type: "row",
      height: maxHeight,
      width: widthSum,
      children,
    };
  }

  function transformArray(value: V[]): Tree<V> {
    let maxWidth = 1;
    let heightSum = 0;
    const children: Tree<V>[] = value.map((v, i) => {
      const child = transformValue(v);
      const width = child.width + 1;
      maxWidth = max(maxWidth, width);
      heightSum += child.height;
      return {
        type: "row",
        width,
        height: child.height,
        children: [
          {
            type: "index",
            value: createIndex(i, value),
            width: 1,
            height: child.height,
          },
          child,
        ],
      };
    });
    if (children.length === 1) {
      return children[0]!;
    }
    return {
      type: "col",
      width: maxWidth,
      height: heightSum,
      children,
    };
  }

  function transformValue(value: V): Tree<V> {
    if (isObject(value)) {
      if (isRecordProto(value)) {
        return transformRecord(value as Record<PropertyKey, V>);
      }
      if (Array.isArray(value)) {
        return transformArray(value);
      }
    }
    return {
      type: "leaf",
      value: value as LeafValue<V>,
      width: 1,
      height: 1,
    };
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
