import { makeProportionalResizeGuard } from "../json-to-table/proportional-resize-guard.js";
import { max } from "../lib/math.js";
import { isObject, isRecordProto } from "../lib/object.js";

import {
  decapitateTree,
  extractHeadersTree,
  extractIndexesTree,
  extractSubtree,
  type LeafValue,
  type Tree,
} from "./tree.js";

export interface TreeFactoryOptions<V> {
  cornerCellValue: LeafValue<V>;
  createHeader: (k: string, record: Record<PropertyKey, V>) => LeafValue<V>;
  createIndex: (i: number, array: V[]) => LeafValue<V>;
  /** proportional size adjustment threshold */
  proportionalSizeAdjustmentThreshold?: number;
  collapseIndexes?: boolean;
}

export function makeTreeFactory<V>({
  cornerCellValue,
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
    const wrapped = Object.entries(value).map(([k, v]) => {
      const child = transformValue(v);
      const height = child.height + 1;
      maxHeight = max(maxHeight, height);
      widthSum += child.width;
      return {
        header: {
          type: "header",
          value: createHeader(k, value),
          height: 1,
          width: child.width,
        } as Tree<V>,
        child,
      };
    });
    const deduped = tryDedupIndexes(
      wrapped.map((w) => w.child),
      wrapped.map((w) => w.header),
    );
    if (deduped !== undefined) {
      return deduped;
    }
    const children: Tree<V>[] = wrapped.map((w) => ({
      type: "col",
      height: w.child.height + 1,
      width: w.child.width,
      children: [w.header, w.child],
    }));
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

  /** mirror of `headerBand` for the leftmost index band */
  function indexBand(node: unknown): Tree<V> | undefined {
    if (node === undefined || node === null) {
      return undefined;
    }
    const n = node as Tree<V>;
    if (!("children" in n)) {
      return n.type === "index" ? n : undefined;
    }
    if (n.type === "col") {
      const children = n.children
        .map((c) => indexBand(c))
        .filter((c): c is Tree<V> => c !== undefined);
      if (children.length === 0) {
        return undefined;
      }
      if (children.length === 1) {
        return children[0]!;
      }
      return {
        type: "col",
        height: children.reduce((sum, c) => sum + c.height, 0),
        width: children.reduce((acc, c) => max(acc, c.width), 1),
        children,
      };
    }
    const bands: Tree<V>[] = [];
    for (const child of n.children) {
      const band = indexBand(child);
      if (band === undefined) {
        break;
      }
      bands.push(band);
    }
    if (bands.length === 0) {
      return undefined;
    }
    if (bands.length === 1) {
      return bands[0]!;
    }
    return {
      type: "row",
      width: bands.reduce((sum, c) => sum + c.width, 0),
      height: bands.reduce((acc, c) => max(acc, c.height), 1),
      children: bands,
    };
  }

  /** flattens a stripped body into rows of leaf cells */
  function flattenBodyRows(node: unknown): Tree<V>[][] | undefined {
    if (node === undefined || node === null) {
      return undefined;
    }
    const n = node as Tree<V>;
    if (!("children" in n)) {
      return n.type === "leaf" ? [[n]] : undefined;
    }
    if (n.type === "row") {
      for (const c of n.children) {
        if ("children" in c) {
          return undefined;
        }
      }
      return [n.children as Tree<V>[]];
    }
    const rows: Tree<V>[][] = [];
    for (const child of n.children) {
      const r = flattenBodyRows(child);
      if (r === undefined) {
        return undefined;
      }
      rows.push(...r);
    }
    return rows;
  }

  function tryDedupIndexes(
    bodies: Tree<V>[],
    headers: Tree<V>[],
  ): Tree<V> | undefined {
    if (bodies.length === 0) {
      return undefined;
    }
    let mask: unknown = extractIndexesTree(bodies[0]!);
    for (let i = 1; i < bodies.length; i++) {
      mask = extractSubtree(bodies[i]!, mask as never);
    }
    if (mask === undefined) {
      return undefined;
    }
    const band = indexBand(mask);
    if (band === undefined || (band.type !== "index" && band.type !== "col")) {
      return undefined;
    }
    const indexNodes: Tree<V>[] =
      band.type === "index"
        ? [band]
        : "children" in band
        ? (band.children as Tree<V>[])
        : [band];
    if (!indexNodes.every((n) => n.height === 1 && n.width === 1)) {
      return undefined;
    }
    const tableRows: Tree<V>[][][] = [];
    for (const body of bodies) {
      const rows = flattenBodyRows(
        decapitateTree(body, mask as never, "index"),
      );
      if (rows === undefined) {
        return undefined;
      }
      tableRows.push(rows);
    }
    const rowCount = indexNodes.length;
    if (
      rowCount === 0 ||
      !tableRows.every((rows) => rows.length === rowCount)
    ) {
      return undefined;
    }
    const columnWidths = tableRows.map((rows) =>
      rows[0]!.reduce((sum, c) => sum + c.width, 0),
    );
    if (
      !tableRows.every((rows) =>
        rows.every(
          (row) => row.reduce((sum, c) => sum + c.width, 0) === columnWidths[0],
        ),
      ) ||
      !columnWidths.every((w) => w === columnWidths[0])
    ) {
      return undefined;
    }
    const corner: Tree<V> = {
      type: "corner",
      value: cornerCellValue,
      width: 1,
      height: 1,
    };
    const sizedHeaders = headers.map((h, k) => ({
      ...h,
      width: columnWidths[k]!,
    }));
    const headerRow: Tree<V> = {
      type: "row",
      height: 1,
      width: corner.width + sizedHeaders.reduce((s, h) => s + h.width, 0),
      children: [corner, ...sizedHeaders],
    };
    const bodyRows: Tree<V>[] = [];
    for (let r = 0; r < rowCount; r++) {
      const cells: Tree<V>[] = [indexNodes[r]!];
      let width = indexNodes[r]!.width;
      for (const rows of tableRows) {
        cells.push(...rows[r]!);
        width += rows[r]!.reduce((sum, c) => sum + c.width, 0);
      }
      bodyRows.push({ type: "row", height: 1, width, children: cells });
    }
    return {
      type: "col",
      height: headerRow.height + bodyRows.reduce((s, r) => s + r.height, 0),
      width: headerRow.width,
      children: [headerRow, ...bodyRows],
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

  interface TopHeader {
    x: number;
    node: Tree<V>;
  }

  /** builds a renderable header tree of any depth from a headers mask */
  function headerBand(node: unknown): Tree<V> | undefined {
    if (node === undefined || node === null) {
      return undefined;
    }
    const n = node as Tree<V>;
    if (!("children" in n)) {
      return n.type === "header" ? n : undefined;
    }
    if (n.type === "row") {
      const children = n.children
        .map((c) => headerBand(c))
        .filter((c): c is Tree<V> => c !== undefined);
      if (children.length === 0) {
        return undefined;
      }
      if (children.length === 1) {
        return children[0]!;
      }
      return {
        type: "row",
        height: children.reduce((acc, c) => max(acc, c.height), 1),
        width: children.reduce((sum, c) => sum + c.width, 0),
        children,
      };
    }
    const headers: Tree<V>[] = [];
    for (const child of n.children) {
      const band = headerBand(child);
      if (band === undefined) {
        break;
      }
      headers.push(band);
    }
    if (headers.length === 0) {
      return undefined;
    }
    if (headers.length === 1) {
      return headers[0]!;
    }
    return {
      type: "col",
      height: headers.reduce((sum, c) => sum + c.height, 0),
      width: headers.reduce((acc, c) => max(acc, c.width), 1),
      children: headers,
    };
  }

  function commonHeaders(
    items: Tree<V>[],
  ): { mask: Tree<V>; band: Tree<V> } | undefined {
    if (items.length === 0) {
      return undefined;
    }
    let mask: unknown = extractHeadersTree(items[0]!);
    for (let i = 1; i < items.length; i++) {
      mask = extractSubtree(items[i]!, mask as never);
    }
    if (mask === undefined) {
      return undefined;
    }
    const band = headerBand(mask);
    if (band === undefined || band.width !== (mask as Tree<V>).width) {
      return undefined;
    }
    return { mask: mask as Tree<V>, band };
  }

  function dedupIndexedRows(value: V[]): Tree<V>[] {
    const items = value.map((v) => transformValue(v));
    const common = commonHeaders(items);
    if (common === undefined) {
      return items.map((child, i) =>
        makeIndexedRow(createIndex(i, value), child),
      );
    }
    const corner: Tree<V> = {
      type: "corner",
      value: cornerCellValue,
      width: 1,
      height: common.band.height,
    };
    const headerBlock: Tree<V> = {
      type: "row",
      height: common.band.height,
      width: corner.width + common.band.width,
      children: [corner, common.band],
    };
    const rows = items.map((item, i) =>
      makeIndexedRow(
        createIndex(i, value),
        decapitateTree(item, common.mask, "header"),
      ),
    );
    return [headerBlock, ...rows];
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
      : dedupIndexedRows(value);
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
