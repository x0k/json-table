import { makeProportionalResizeGuard } from "../json-to-table/proportional-resize-guard.js";
import { lcm, max } from "../lib/math.js";
import { isJsonPrimitive, type JSONValue } from "../lib/json.js";
import { isObject, isRecordProto } from "../lib/object.js";

import {
  decapitateTree,
  extractHeadersTree,
  extractIndexesTree,
  extractSubtree,
  isTreeStructurallyEquals,
  stretchLeavesDimensionInPlace,
  type LeafValue,
  type Tree,
} from "./tree.js";

export interface TreeFactoryOptions<V> {
  cornerCellValue: LeafValue<V>;
  createHeader: (k: string, record: Record<PropertyKey, V>) => LeafValue<V>;
  createIndex: (i: number, array: V[]) => LeafValue<V>;
  joinPrimitiveArrayValues?: boolean;
  /** proportional size adjustment threshold */
  proportionalSizeAdjustmentThreshold?: number;
  collapseIndexes?: boolean;
}

export function makeTreeFactory<V>({
  cornerCellValue,
  createHeader,
  createIndex,
  joinPrimitiveArrayValues,
  proportionalSizeAdjustmentThreshold = 1,
  collapseIndexes,
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

  /** top-level header of a record key column (plain or corner-merged) */
  function childTopHeader(child: Tree<V>): Tree<V> | undefined {
    if (child.type === "col" && "children" in child) {
      const first = child.children[0];
      if (first !== undefined && first.type === "header") {
        return first;
      }
      if (first !== undefined && first.type === "row" && "children" in first) {
        const inner = first.children[1];
        if (
          first.children[0]?.type === "corner" &&
          inner !== undefined &&
          inner.type === "col" &&
          "children" in inner &&
          inner.children[0]?.type === "header"
        ) {
          return inner.children[0];
        }
      }
    }
    if (
      child.type === "row" &&
      "children" in child &&
      child.children[0]?.type === "corner"
    ) {
      const inner = child.children[1];
      if (
        inner !== undefined &&
        inner.type === "col" &&
        "children" in inner &&
        inner.children[0]?.type === "header"
      ) {
        return inner.children[0];
      }
    }
    return undefined;
  }

  function stripChildTopHeader(child: Tree<V>): Tree<V> {
    if (child.type === "col" && "children" in child) {
      const first = child.children[0];
      if (first !== undefined && first.type === "header") {
        const rest = child.children.slice(1);
        if (rest.length === 1) {
          return rest[0]!;
        }
        return { ...child, height: child.height - 1, children: rest };
      }
      if (
        first !== undefined &&
        first.type === "row" &&
        "children" in first &&
        first.children[0]?.type === "corner"
      ) {
        const inner = first.children[1];
        if (
          inner !== undefined &&
          inner.type === "col" &&
          "children" in inner &&
          inner.children[0]?.type === "header"
        ) {
          const rest = inner.children.slice(1);
          const strippedInner: Tree<V> =
            rest.length === 1
              ? rest[0]!
              : { ...inner, height: inner.height - 1, children: rest };
          const newCorner: Tree<V> = {
            ...(first.children[0] as Tree<V>),
            height: strippedInner.height,
          };
          const strippedBlock: Tree<V> = {
            ...first,
            height: newCorner.height,
            children: [newCorner, strippedInner],
          };
          const rest2 = child.children.slice(1);
          return {
            ...child,
            height:
              strippedBlock.height +
              rest2.reduce((sum, c) => sum + c.height, 0),
            children: [strippedBlock, ...rest2],
          };
        }
      }
    }
    if (
      child.type === "row" &&
      "children" in child &&
      child.children[0]?.type === "corner" &&
      child.children.length === 2
    ) {
      const inner = child.children[1]!;
      if (
        "children" in inner &&
        inner.type === "col" &&
        inner.children[0]?.type === "header"
      ) {
        const [corner] = child.children as [Tree<V>];
        const rest = inner.children.slice(1);
        const strippedInner: Tree<V> =
          rest.length === 1
            ? rest[0]!
            : { ...inner, height: inner.height - 1, children: rest };
        return { ...child, children: [corner, strippedInner] };
      }
    }
    return child;
  }

  function topLevelHeaders(item: Tree<V>): Tree<V>[] | undefined {
    const cols = item.type === "row" ? item.children : [item];
    const headers: Tree<V>[] = [];
    for (const col of cols) {
      const header = childTopHeader(col);
      if (header === undefined) {
        return undefined;
      }
      headers.push(header);
    }
    return headers;
  }

  function stripTopHeaders(item: Tree<V>): Tree<V> {
    if (item.type === "row") {
      let height = 1;
      let width = 0;
      const children = item.children.map(stripChildTopHeader);
      for (const child of children) {
        height = max(height, child.height);
        width += child.width;
      }
      if (children.length === 1) {
        return children[0]!;
      }
      return { ...item, height, width, children };
    }
    return stripChildTopHeader(item);
  }

  /** mirrors the block horizontal stacker: equalize column-body heights
   * to their lcm when proportional, else to the maximum */
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

  function dedupIndexedRows(value: V[]): Tree<V>[] {
    const items = value.map((v) => transformValue(v));
    const common = commonHeaders(items);
    if (common === undefined) {
      const lists = items.map(topLevelHeaders);
      if (
        lists.every((l) => l !== undefined) &&
        lists[0]!.length > 0 &&
        lists.every(
          (l) =>
            l!.length === lists[0]!.length &&
            l!.every((h, k) => isTreeStructurallyEquals(h, lists[0]![k])),
        )
      ) {
        const corner: Tree<V> = {
          type: "corner",
          value: cornerCellValue,
          width: 1,
          height: 1,
        };
        const headerRow: Tree<V> = {
          type: "row",
          height: 1,
          width: corner.width + lists[0]!.reduce((s, h) => s + h.width, 0),
          children: [corner, ...lists[0]!],
        };
        const rows = items.map((item, i) => {
          const body = stripTopHeaders(item);
          equalizeBodyHeights(body);
          return makeIndexedRow(createIndex(i, value), body);
        });
        return [headerRow, ...rows];
      }
      const commonWidth = items.reduce((acc, item) => lcm(acc, item.width), 1);
      for (const item of items) {
        scaleWidthsInPlace(item, commonWidth / item.width);
      }
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
