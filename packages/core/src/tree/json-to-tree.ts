import { makeProportionalResizeGuard } from "../json-to-table/proportional-resize-guard.js";
import { max } from "../lib/math.js";
import { isObject, isRecordProto } from "../lib/object.js";

import { type LeafValue, type Tree } from "./tree.js";

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
