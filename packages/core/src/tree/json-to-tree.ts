import { makeProportionalResizeGuard } from "../json-to-table/proportional-resize-guard.js";
import { lcm, max } from "../lib/math.js";
import { isJsonPrimitive, type JSONValue } from "../lib/json.js";
import { isObject, isPlainObject, isRecordProto } from "../lib/object.js";
import { makePropertiesStabilizer } from "./properties-stabilizer.js";

import {
  type ComponentKind,
  decapitateTree,
  extractComponentTree,
  extractIndexesTree,
  extractSubtree,
  stretchLeavesDimensionInPlace,
  type LeafValue,
  type Tree,
} from "./tree.js";

const HEAD_KINDS: ReadonlySet<ComponentKind> = new Set([
  "header",
  "corner",
] as const);
const INDEX_KINDS: ReadonlySet<ComponentKind> = new Set(["index"] as const);

export interface TreeFactoryOptions<V> {
  cornerCellValue: LeafValue<V>;
  createHeader: (k: string, record: Record<PropertyKey, V>) => LeafValue<V>;
  createIndex: (i: number, array: V[]) => LeafValue<V>;
  joinPrimitiveArrayValues?: boolean;
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
  proportionalSizeAdjustmentThreshold = 1,
  collapseIndexes,
  stabilizeOrderOfPropertiesInArraysOfObjects = true,
}: TreeFactoryOptions<V>) {
  const isProportionalResize = makeProportionalResizeGuard(
    proportionalSizeAdjustmentThreshold,
  );

  /** when a child carries its own corner-augmented header block (from an
   * index-producing array), merge the record header into that block */
  function wrapWithHeader(header: Tree<V>, child: Tree<V>): Tree<V> {
    const top = child.type === "col" ? child.children[0] : undefined;
    if (
      child.type === "col" &&
      child.children.length > 1 &&
      top !== undefined &&
      top.type === "row" &&
      "children" in top &&
      top.children[0]?.type === "corner"
    ) {
      const [corner, ...headers] = top.children as Tree<V>[];
      const headersRow: Tree<V> = {
        type: "row",
        height: 1,
        width: headers.reduce((sum, c) => sum + c.width, 0),
        children: headers,
      };
      const headerCol: Tree<V> = {
        type: "col",
        height: 1 + headersRow.height,
        width: headersRow.width,
        children: [{ ...header, width: headersRow.width }, headersRow],
      };
      const newCorner: Tree<V> = {
        ...(corner as Tree<V>),
        height: 1 + headersRow.height,
      };
      const block: Tree<V> = {
        type: "row",
        height: newCorner.height,
        width: newCorner.width + headerCol.width,
        children: [newCorner, headerCol],
      };
      return {
        type: "col",
        height: block.height + child.height - top.height,
        width: block.width,
        children: [block, ...child.children.slice(1)],
      };
    }
    return {
      type: "col",
      height: child.height + 1,
      width: child.width,
      children: [header, child],
    };
  }

  function scaleHeightsInPlace(tree: Tree<V>, m: number): void {
    if (m === 1) {
      return;
    }
    tree.height *= m;
    if ("children" in tree) {
      for (const child of tree.children) {
        scaleHeightsInPlace(child, m);
      }
    }
  }

  function transformRecord(value: Record<PropertyKey, V>): Tree<V> {
    let maxHeight = 1;
    let widthSum = 0;
    const wrapped = Object.entries(value).map(([k, v]) => {
      const child = transformValue(v);
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
    const children: Tree<V>[] = wrapped.map((w) =>
      wrapWithHeader(w.header, w.child),
    );
    for (const wrapped of children) {
      maxHeight = max(maxHeight, wrapped.height);
      widthSum += wrapped.width;
    }
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
        decapitateTree(body, mask as never, INDEX_KINDS),
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

  /** header chain of a record key column: plain col[header, X] nesting only;
   * corner-merged wrappers contribute their single inner header and stop */
  function equalizeBodyHeights(body: Tree<V>): void {
    if (body.type !== "row" || !("children" in body) || body.children.length < 2) {
      return;
    }
    let lcmHeight = body.children[0]!.height;
    let maxHeight = lcmHeight;
    for (let i = 1; i < body.children.length; i++) {
      lcmHeight = lcm(lcmHeight, body.children[i]!.height);
      maxHeight = max(maxHeight, body.children[i]!.height);
    }
    const finalHeight = isProportionalResize(lcmHeight, maxHeight)
      ? lcmHeight
      : maxHeight;
    for (const child of body.children) {
      const multiplier = Math.floor(finalHeight / child.height);
      if (multiplier > 1) {
        scaleHeightsInPlace(child, multiplier);
      }
      if (child.height < finalHeight) {
        stretchLeavesDimensionInPlace(child, "height", finalHeight);
      }
    }
    body.height = finalHeight;
  }

  /** converts a header mask into a renderable band tree:
   * undefined holes are dropped, sizes recomputed from kept children */
  function maskToBand<V>(mask: unknown): Tree<V> | undefined {
    if (mask === undefined || mask === null) {
      return undefined;
    }
    const m = mask as Tree<V>;
    if (!("children" in m)) {
      return m.type === "header" || m.type === "corner" ? m : undefined;
    }
    const children = m.children
      .map((c) => maskToBand(c))
      .filter((c): c is Tree<V> => c !== undefined);
    if (children.length === 0) {
      return undefined;
    }
    if (children.length === 1) {
      const only = children[0]!;
      // a lone survivor of a row inherits the row's full width
      if (m.type === "row" && only.width < m.width) {
        stretchLeavesDimensionInPlace(only, "width", m.width);
      }
      return only;
    }
    const isRow = m.type === "row";
    return {
      type: m.type,
      height: isRow
        ? children.reduce((acc, c) => max(acc, c.height), 1)
        : children.reduce((sum, c) => sum + c.height, 0),
      width: isRow
        ? children.reduce((sum, c) => sum + c.width, 0)
        : children.reduce((acc, c) => max(acc, c.width), 1),
      children,
    };
  }

  function scaleWidthsInPlace(tree: Tree<V>, m: number): void {
    if (m === 1) {
      return;
    }
    tree.width *= m;
    if ("children" in tree) {
      for (const child of tree.children) {
        scaleWidthsInPlace(child, m);
      }
    }
  }

  function dedupIndexedRows(value: V[]): Tree<V>[] {
    const items = value.map((v) => transformValue(v));
    const columnsOf = (item: Tree<V>): Tree<V>[] =>
      item.type === "row" && "children" in item ? item.children : [item];
    // proportional-ish width alignment across items: narrower items
    // stretch their trailing columns to match the widest item
    const maxWidth = items.reduce((acc, item) => max(acc, item.width), 1);
    for (const item of items) {
      if (item.width < maxWidth) {
        stretchLeavesDimensionInPlace(item, "width", maxWidth);
      }
    }
    let common: unknown = extractComponentTree(items[0]!, HEAD_KINDS);
    for (let i = 1; i < items.length; i++) {
      common = extractSubtree(items[i] as never, common as never);
    }
    if (common !== undefined) {
      // extractSubtree carries the last-folded item's geometry: restore
      // the first item's extents, where the mask was originally seeded
      const adopt = (commonNode: any, itemNode: any): void => {
        if (!commonNode || !itemNode) {
          return;
        }
        if ("width" in itemNode) {
          commonNode.width = itemNode.width;
        }
        if ("children" in commonNode && "children" in itemNode) {
          const len = Math.min(
            commonNode.children.length,
            itemNode.children.length,
          );
          for (let i = 0; i < len; i++) {
            adopt(commonNode.children[i], itemNode.children[i]);
          }
        }
      };
      adopt(common as never, items[0]);
    }
    if (common === undefined) {
      return items.map((child, i) =>
        makeIndexedRow(createIndex(i, value), child),
      );
    }

    const commonNode = common as Tree<V>;
    const bodies = items.map((item) =>
      decapitateTree(item, common as never, HEAD_KINDS),
    );
    const commonBand = maskToBand(commonNode) as Tree<V>;
    if (commonBand === undefined) {
      // unreachable when `common` is defined
      throw new Error("empty common header band");
    }
    const bandHeight = commonBand.height;
    const corner: Tree<V> = {
      type: "corner",
      value: cornerCellValue,
      width: 1,
      height: bandHeight,
    };
    const headerBlock: Tree<V> = {
      type: "row",
      height: bandHeight,
      width: corner.width + commonBand.width,
      children: [corner, commonBand],
    };
    const rows = bodies.map((body, i) => {
      const filled = body;
      equalizeBodyHeights(filled);
      return makeIndexedRow(createIndex(i, value), filled);
    });
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
    if (value.length === 0) {
      return {
        type: "leaf",
        value: "" as LeafValue<V>,
        width: 1,
        height: 1,
      };
    }
    let maxWidth = 1;
    let heightSum = 0;
    if (joinPrimitiveArrayValues) {
      let isPrimitives = true;
      for (const v of value) {
        isPrimitives = isPrimitives && isJsonPrimitive(v as JSONValue);
      }
      if (isPrimitives) {
        return {
          type: "leaf",
          value: value.join(", ") as LeafValue<V>,
          width: 1,
          height: 1,
        };
      }
    }
    if (
      stabilizeOrderOfPropertiesInArraysOfObjects &&
      value.every((v) => isPlainObject(v))
    ) {
      const stabilize = makePropertiesStabilizer<V>();
      value = value.map((item) => {
        const stabilized: Record<string, V> = {};
        for (const { key, value: v } of stabilize(
          item as Record<string, V>,
        )) {
          stabilized[key] = v;
        }
        return stabilized as unknown as V;
      });
    }
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
      if ("toJSON" in value && typeof value["toJSON"] === "function") {
        return transformValue(value.toJSON() as V);
      }
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
