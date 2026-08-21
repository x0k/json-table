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
  collapseIndexes?: boolean;
}

export function makeTreeFactory<V>({
  createHeader,
  createIndex,
  proportionalSizeAdjustmentThreshold = 1,
  collapseIndexes,
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

  function makeIndexedRow(indexValue: LeafValue<V>, child: Tree<V>): Tree<V> {
    return {
      type: "row",
      width: child.width + 1,
      height: child.height,
      children: [
        {
          type: "index",
          value: indexValue,
          width: 1,
          height: child.height,
        },
        child,
      ],
    };
  }

  function collapseRows(value: V[], prefix: string): Tree<V>[] {
    const rows: Tree<V>[] = [];
    for (let i = 0; i < value.length; i++) {
      const title = String(createIndex(i, value));
      const v = value[i]!;
      if (Array.isArray(v) && v.length > 0) {
        rows.push(...collapseRows(v as V[], `${prefix}${title}.`));
      } else {
        rows.push(
          makeIndexedRow(
            `${prefix}${title}` as LeafValue<V>,
            transformValue(v),
          ),
        );
      }
    }
    return rows;
  }

  function transformArray(value: V[]): Tree<V> {
    let maxWidth = 1;
    let heightSum = 0;
    const children: Tree<V>[] = collapseIndexes
      ? collapseRows(value, "")
      : value.map((v, i) => {
          const child = transformValue(v);
          return makeIndexedRow(createIndex(i, value), child);
        });
    for (const child of children) {
      maxWidth = max(maxWidth, child.width);
      heightSum += child.height;
    }
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
