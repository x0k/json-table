import { makeProportionalResizeGuard } from "../lib/proportional-resize-guard.js";
import { TO_TABLE } from "../json-table.js";
import { lcm, max } from "../lib/math.js";
import { isJsonPrimitive, type JSONValue } from "../lib/json.js";
import { isObject, isPlainObject, isRecordProto } from "../lib/object.js";
import { makePropertiesStabilizer } from "./properties-stabilizer.js";

import {
  type ComponentKind,
  decapitateTree,
  extractComponentTree,
  extractSubtree,
  stretchLeavesDimensionInPlace,
  type LeafValue,
  type OptionalTree,
  type Tree,
  INDEX_KINDS,
} from "./tree.js";

const DEDUP_KINDS: ReadonlySet<ComponentKind> = new Set([
  "header",
  "corner",
] as const);

export interface TreeFactoryOptions<V> {
  cornerCellValue: LeafValue<V>;
  createHeader: (k: string, record: Record<PropertyKey, V>) => LeafValue<V>;
  createIndex: (i: number, array: V[]) => LeafValue<V>;
  joinPrimitiveArrayValues?: boolean;
  /** proportional size adjustment threshold */
  proportionalSizeAdjustmentThreshold?: number;
  collapseIndexes?: boolean;
  stabilizeOrderOfPropertiesInArraysOfObjects?: boolean;
  /** lift common headers of array items into a shared band (default true) */
  deduplicateHeaders?: boolean;
}

export function makeTreeFactory<V>({
  cornerCellValue,
  createHeader,
  createIndex,
  joinPrimitiveArrayValues,
  proportionalSizeAdjustmentThreshold = 1,
  collapseIndexes,
  stabilizeOrderOfPropertiesInArraysOfObjects = true,
  deduplicateHeaders = true,
}: TreeFactoryOptions<V>) {
  const isProportionalResize = makeProportionalResizeGuard(
    proportionalSizeAdjustmentThreshold,
  );

  /** when a child carries its own corner-augmented header block (from an
   * index-producing array), merge the record header into that block */
  function wrapWithHeader(header: Tree<V>, child: Tree<V>): Tree<V> {
    const top =
      child.type === "col" && child.children.length > 1
        ? child.children[0]
        : undefined;
    if (
      child.type === "col" &&
      child.children.length > 1 &&
      top !== undefined &&
      top.type === "row" &&
      top.children[0]?.type === "corner"
    ) {
      const corner = top.children[0]!;
      let headersWidth = 0;
      let headersHeight = 1;
      for (let i = 1; i < top.children.length; i++) {
        headersWidth += top.children[i]!.width;
        headersHeight = max(headersHeight, top.children[i]!.height);
      }
      const headersRow: Tree<V> = {
        type: "row",
        height: headersHeight,
        width: headersWidth,
        children: top.children.slice(1),
      };
      const headerCol: Tree<V> = {
        type: "col",
        height: 1 + headersRow.height,
        width: headersRow.width,
        children: [{ ...header, width: headersRow.width }, headersRow],
      };
      const newCorner: Tree<V> = {
        ...corner,
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
    const keys = Object.keys(value);
    const bodies: Tree<V>[] = new Array(keys.length);
    const headers: Tree<V>[] = new Array(keys.length);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]!;
      const child = transformValue(value[k]!);
      headers[i] = {
        type: "header",
        value: createHeader(k, value),
        height: 1,
        width: child.width,
      };
      bodies[i] = child;
    }
    const deduped = tryDedupIndexes(bodies, headers);
    if (deduped !== undefined) {
      return deduped;
    }
    let maxHeight = 1;
    let widthSum = 0;
    const children: Tree<V>[] = new Array(keys.length);
    for (let i = 0; i < children.length; i++) {
      const wrapped = wrapWithHeader(headers[i]!, bodies[i]!);
      maxHeight = max(maxHeight, wrapped.height);
      widthSum += wrapped.width;
      children[i] = wrapped;
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
  function indexBand(node: OptionalTree<V>): Tree<V> | undefined {
    if (node === undefined) {
      return undefined;
    }
    const n = node;
    if (!("children" in n)) {
      return n.type === "index" ? n : undefined;
    }
    if (n.type === "col") {
      const children: Tree<V>[] = [];
      for (const c of n.children) {
        const band = indexBand(c);
        if (band !== undefined) {
          children.push(band);
        }
      }
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
  function flattenBodyRows(
    node: OptionalTree<V>,
    rows: Tree<V>[][] = [],
  ): Tree<V>[][] | undefined {
    if (node === undefined) {
      return undefined;
    }
    const n = node;
    if (!("children" in n)) {
      if (n.type !== "leaf") {
        return undefined;
      }
      rows.push([n]);
      return rows;
    }
    if (n.type === "row") {
      const row: Tree<V>[] = [];
      for (const c of n.children) {
        if (c === undefined || "children" in c) {
          return undefined;
        }
        row.push(c);
      }
      rows.push(row);
      return rows;
    }
    for (const child of n.children) {
      if (flattenBodyRows(child, rows) === undefined) {
        return undefined;
      }
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
    let mask: OptionalTree<V> = extractComponentTree(bodies[0]!, INDEX_KINDS);
    for (let i = 1; i < bodies.length; i++) {
      mask = extractSubtree(bodies[i]!, mask);
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
        ? band.children
        : [band];
    if (!indexNodes.every((n) => n.height === 1 && n.width === 1)) {
      return undefined;
    }
    const tableRows: Tree<V>[][][] = [];
    for (const body of bodies) {
      const rows = flattenBodyRows(decapitateTree(body, mask, INDEX_KINDS));
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
    let rowWidth = -1;
    for (const rows of tableRows) {
      for (const row of rows) {
        let w = 0;
        for (const c of row) {
          w += c.width;
        }
        if (rowWidth < 0) {
          rowWidth = w;
        } else if (w !== rowWidth) {
          return undefined;
        }
      }
    }
    const corner: Tree<V> = {
      type: "corner",
      value: cornerCellValue,
      width: 1,
      height: 1,
    };
    const sizedHeaders = headers.map((h) => ({
      ...h,
      width: rowWidth,
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
      let height = indexNodes[r]!.height;
      for (const rows of tableRows) {
        const row = rows[r]!;
        for (const c of row) {
          cells.push(c);
          width += c.width;
          height = max(height, c.height);
        }
      }
      bodyRows.push({ type: "row", height, width, children: cells });
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

  /** header chain of a record key column: plain col[header, X] nesting only;
   * corner-merged wrappers contribute their single inner header and stop */
  function equalizeBodyHeights(body: Tree<V>): void {
    if (
      body.type !== "row" ||
      !("children" in body) ||
      body.children.length < 2
    ) {
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
  function maskToBand(mask: OptionalTree<V>): Tree<V> | undefined {
    if (mask === undefined) {
      return undefined;
    }
    const m = mask;
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
      // a lone survivor of a structurally single-child row inherits the
      // row's full width; when siblings were dropped as undefined holes
      // the surviving width is already the honest one
      if (
        m.type === "row" &&
        m.children.every((c) => c !== undefined) &&
        only.width < m.width
      ) {
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

  /** lifts a header band common to all rows into a single band on top of
   * the table; `indexed` wraps each body with a fresh index cell, otherwise
   * rows are expected to carry their own (collapsed) indexes */
  function stackRowsWithHeaders(
    rows: Tree<V>[],
    value: V[],
    indexed: boolean,
  ): Tree<V>[] {
    let common: OptionalTree<V> =
      deduplicateHeaders === false || rows.length === 0
        ? undefined
        : extractComponentTree(rows[0]!, DEDUP_KINDS);
    for (let i = 1; i < rows.length; i++) {
      common = extractSubtree(rows[i]!, common);
    }
    if (common !== undefined) {
      // extractSubtree carries the last-folded row's geometry: restore
      // the first row's extents, where the mask was originally seeded
      const adopt = (
        commonNode: OptionalTree<V>,
        itemNode: OptionalTree<V>,
      ): void => {
        if (commonNode === undefined || itemNode === undefined) {
          return;
        }
        commonNode.width = itemNode.width;
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
      adopt(common, rows[0]);
    }
    if (common === undefined) {
      if (!indexed) {
        return rows;
      }
      return rows.map((child, i) =>
        makeIndexedRow(createIndex(i, value), child),
      );
    }

    const commonBand = maskToBand(common);
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
    const out: Tree<V>[] = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      const body = decapitateTree(rows[i]!, common, DEDUP_KINDS);
      if (
        !indexed &&
        "children" in body &&
        body.children[0]?.type === "index"
      ) {
        // a collapsed index spans its original (pre-strip) row height:
        // resize it to the remaining body once the common band is lifted
        const indexCell = body.children[0];
        let restHeight = 1;
        for (let j = 1; j < body.children.length; j++) {
          restHeight = max(restHeight, body.children[j]!.height);
        }
        indexCell.height = restHeight;
        body.height = restHeight;
      }
      equalizeBodyHeights(body);
      out[i] = !indexed ? body : makeIndexedRow(createIndex(i, value), body);
    }
    const result: Tree<V>[] = new Array(out.length + 1);
    result[0] = headerBlock;
    for (let i = 0; i < out.length; i++) {
      result[i + 1] = out[i]!;
    }
    return result;
  }

  function dedupIndexedRows(value: V[]): Tree<V>[] {
    const items = value.map((v) => transformValue(v));
    // proportional-ish width alignment across items: narrower items
    // stretch their trailing columns to match the widest item
    const maxWidth = items.reduce((acc, item) => max(acc, item.width), 1);
    for (const item of items) {
      if (item.width < maxWidth) {
        stretchLeavesDimensionInPlace(item, "width", maxWidth);
      }
    }
    return stackRowsWithHeaders(items, value, true);
  }

  function collapseRows(
    value: V[],
    prefix: string,
    rows: Tree<V>[] = [],
  ): Tree<V>[] {
    for (let i = 0; i < value.length; i++) {
      const v = value[i]!;
      const title = String(createIndex(i, value));
      if (Array.isArray(v) && v.length > 0) {
        collapseRows(v, `${prefix}${title}.`, rows);
      } else {
        rows.push(
          makeIndexedRow(`${prefix}${title}` as LeafValue<V>, transformValue(v)),
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
    // a single-element array renders exactly as its only element:
    // an index column for one row carries no information
    if (value.length === 1) {
      return transformValue(value[0]!);
    }
    let maxWidth = 1;
    let heightSum = 0;
    if (joinPrimitiveArrayValues) {
      let isPrimitives = true;
      for (let i = 0; i < value.length; i++) {
        if (!isJsonPrimitive(value[i] as JSONValue)) {
          isPrimitives = false;
          break;
        }
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
    if (stabilizeOrderOfPropertiesInArraysOfObjects) {
      let isPlainObjects = true;
      for (let i = 0; i < value.length; i++) {
        if (!isPlainObject(value[i])) {
          isPlainObjects = false;
          break;
        }
      }
      if (isPlainObjects) {
        const stabilize = makePropertiesStabilizer<V>();
        const stabilizedValues = new Array<V>(value.length);
        for (let i = 0; i < value.length; i++) {
          const stabilized: Record<string, V> = {};
          for (const { key, value: v } of stabilize(
            value[i] as Record<string, V>,
          )) {
            stabilized[key] = v;
          }
          stabilizedValues[i] = stabilized as unknown as V;
        }
        value = stabilizedValues;
      }
    }
    const children: Tree<V>[] = collapseIndexes
      ? stackRowsWithHeaders(collapseRows(value, ""), value, false)
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
      if (
        TO_TABLE in value &&
        typeof value[TO_TABLE as keyof object] === "function"
      ) {
        return (value as { [TO_TABLE]: () => Tree<V> })[TO_TABLE]();
      }
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
