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
  TO_TABLE,
} from "./model.js";
import { lcm, max } from "./lib/math.js";
import { isJsonPrimitive, type JSONValue } from "./lib/json.js";
import { isObject, isPlainObject, isRecordProto } from "./lib/object.js";
import { makePropertiesStabilizer } from "./properties-stabilizer.js";
import { makeProportionalResizeGuard } from "./proportional-resize-guard.js";

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

  /** extents derive from children: sequential sums, cross takes the max */
  function sizedContainer(type: "row" | "col", children: Tree<V>[]): Tree<V> {
    const isRow = type === "row";
    let sequential = 0;
    let cross = 1;
    for (const child of children) {
      sequential += isRow ? child.width : child.height;
      cross = max(cross, isRow ? child.height : child.width);
    }
    return {
      type,
      width: isRow ? sequential : cross,
      height: isRow ? cross : sequential,
      children,
    };
  }

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
      const headersRow = sizedContainer("row", top.children.slice(1));
      const headerCol = sizedContainer("col", [
        { ...header, width: headersRow.width },
        headersRow,
      ]);
      const newCorner: Tree<V> = {
        ...corner,
        height: headerCol.height,
      };
      const block = sizedContainer("row", [newCorner, headerCol]);
      return sizedContainer("col", [block, ...child.children.slice(1)]);
    }
    return sizedContainer("col", [header, child]);
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

  function transformRecord(
    value: Record<PropertyKey, V>,
    insideArrayItem: boolean,
  ): Tree<V> {
    const keys = Object.keys(value);
    const bodies: Tree<V>[] = new Array(keys.length);
    const headers: Tree<V>[] = new Array(keys.length);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]!;
      const child = parseValue(value[k]!, insideArrayItem);
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
    const children: Tree<V>[] = new Array(keys.length);
    for (let i = 0; i < keys.length; i++) {
      children[i] = wrapWithHeader(headers[i]!, bodies[i]!);
    }
    if (children.length === 1) {
      return children[0]!;
    }
    // Equalize side-by-side columns band/body separately, never scaling
    // headers. Skipped inside array items: header lifting re-aligns their
    // bodies itself, and filler added here would survive decapitation.
    if (!insideArrayItem) {
      equalizeRecordColumns(children);
    }
    return sizedContainer("row", children);
  }

  /** leftmost index band of a subtree, if any */
  function indexBand(node: OptionalTree<V>): Tree<V> | undefined {
    if (node === undefined) {
      return undefined;
    }
    if (!("children" in node)) {
      return node.type === "index" ? node : undefined;
    }
    if (node.type === "col") {
      const children: Tree<V>[] = [];
      for (const c of node.children) {
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
      return sizedContainer("col", children);
    }
    const bands: Tree<V>[] = [];
    for (const child of node.children) {
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
    return sizedContainer("row", bands);
  }

  /** flattens a stripped body into rows of leaf cells */
  function flattenBodyRows(
    node: OptionalTree<V>,
    rows: Tree<V>[][] = [],
  ): Tree<V>[][] | undefined {
    if (node === undefined) {
      return undefined;
    }
    if (!("children" in node)) {
      if (node.type !== "leaf") {
        return undefined;
      }
      rows.push([node]);
      return rows;
    }
    if (node.type === "row") {
      const row: Tree<V>[] = [];
      for (const c of node.children) {
        if (c === undefined || "children" in c) {
          return undefined;
        }
        row.push(c);
      }
      rows.push(row);
      return rows;
    }
    for (const child of node.children) {
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
    const headerRow = sizedContainer("row", [
      corner,
      ...headers.map((h) => ({ ...h, width: rowWidth })),
    ]);
    const bodyRows: Tree<V>[] = [];
    for (let r = 0; r < rowCount; r++) {
      const cells: Tree<V>[] = [indexNodes[r]!];
      for (const rows of tableRows) {
        const row = rows[r]!;
        for (const c of row) {
          cells.push(c);
        }
      }
      bodyRows.push(sizedContainer("row", cells));
    }
    return sizedContainer("col", [headerRow, ...bodyRows]);
  }

  function makeIndexedRow(indexValue: LeafValue<V>, child: Tree<V>): Tree<V> {
    return sizedContainer("row", [
      {
        type: "index",
        value: indexValue,
        width: 1,
        height: child.height,
      },
      child,
    ]);
  }

  /** trailing blank filling the gap to the target height */
  function padHeightWithEmpty(node: Tree<V>, targetHeight: number): Tree<V> {
    const deficit = targetHeight - node.height;
    if (deficit <= 0) {
      return node;
    }
    const filler: Tree<V> = {
      type: "leaf",
      value: "" as LeafValue<V>,
      width: node.width,
      height: deficit,
    };
    return sizedContainer("col", [node, filler]);
  }

  /** fits a lifted result row to the target width: scalar values spanning
   * their row and header bands stretch (horizontal centering misattributes
   * nothing); data rows over missing columns get a trailing blank */
  function fitRowWidth(row: Tree<V>, targetWidth: number): Tree<V> {
    if (row.width >= targetWidth) {
      return row;
    }
    if ("children" in row) {
      const [first, second, ...rest] = row.children;
      const isIndexedScalar =
        rest.length === 0 &&
        first !== undefined &&
        !("children" in first) &&
        first.type === "index" &&
        second !== undefined &&
        !("children" in second) &&
        second.type === "leaf";
      const isHeaderBand = row.children.every(
        (c) =>
          !("children" in c) && (c.type === "header" || c.type === "corner"),
      );
      if (isIndexedScalar || isHeaderBand) {
        stretchLeavesDimensionInPlace(row, "width", targetWidth);
        return row;
      }
    }
    return padWidthWithEmpty(row, targetWidth);
  }

  /** trailing blank filling the gap to the target width; rows absorb it as
   * a new trailing cell so their flat shape survives header lifting */
  function padWidthWithEmpty(node: Tree<V>, targetWidth: number): Tree<V> {
    const deficit = targetWidth - node.width;
    if (deficit <= 0) {
      return node;
    }
    const filler: Tree<V> = {
      type: "leaf",
      value: "" as LeafValue<V>,
      width: deficit,
      height: node.height,
    };
    if (node.type === "row" && "children" in node) {
      node.children.push(filler);
      node.width = targetWidth;
      return node;
    }
    return sizedContainer("row", [node, filler]);
  }

  /** splits a column into its header band and pure data body (leaves and
   * indexes); bandless columns equalize as a whole */
  function splitBandBody(child: Tree<V>): {
    band: Tree<V> | undefined;
    body: Tree<V>;
  } {
    const mask = extractComponentTree(child, DEDUP_KINDS);
    if (mask === undefined) {
      return { band: undefined, body: child };
    }
    const band = maskToBand(mask);
    if (band === undefined) {
      return { band: undefined, body: child };
    }
    return { band, body: decapitateTree(child, mask, DEDUP_KINDS) };
  }

  /** whether a subtree holds tabular data rows (vs plain scalar attributes) */
  function containsIndex(node: Tree<V>): boolean {
    return "children" in node
      ? node.children.some(containsIndex)
      : node.type === "index";
  }

  /** equalizes side-by-side record columns: bands stay top-aligned and are
   * never scaled; scalar-only bodies stretch, data bodies scale uniformly
   * while the resize guard allows it, and any remainder becomes a trailing
   * blank — never dumped onto one data row */
  function equalizeRecordColumns(children: Tree<V>[]): void {
    // NOTE: the target derives from original column heights. Band plus body
    // can exceed it (nested headers sit beside data, not above it), so
    // summing them would inflate the total with phantom rows.
    let totalHeight = 1;
    for (let i = 0; i < children.length; i++) {
      totalHeight = max(totalHeight, children[i]!.height);
    }
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      // Full-height columns keep their subtree untouched: reassembly would
      // needlessly relocate nested header chains.
      if (child.height >= totalHeight) {
        continue;
      }
      const { band, body } = splitBandBody(child);
      const target = totalHeight - (band?.height ?? 0);
      if (body.height >= target) {
        // Interleaved band/body already span the full height.
        continue;
      }
      let fittedBody = body;
      if (!containsIndex(body)) {
        stretchLeavesDimensionInPlace(body, "height", target);
      } else {
        const multiplier = Math.floor(target / body.height);
        if (
          multiplier > 1 &&
          isProportionalResize(body.height * multiplier, body.height)
        ) {
          scaleHeightsInPlace(body, multiplier);
        }
        if (body.height < target) {
          fittedBody = padHeightWithEmpty(body, target);
        }
      }
      children[i] =
        band === undefined
          ? fittedBody
          : sizedContainer("col", [band, fittedBody]);
    }
  }

  /** equalizes heights: LCM-scales while the guard allows it, otherwise
   * pads short children with a trailing blank */
  function equalizeSiblingHeights(children: Tree<V>[]): number {
    let lcmHeight = children[0]!.height;
    let maxHeight = lcmHeight;
    for (let i = 1; i < children.length; i++) {
      lcmHeight = lcm(lcmHeight, children[i]!.height);
      maxHeight = max(maxHeight, children[i]!.height);
    }
    if (!isProportionalResize(lcmHeight, maxHeight)) {
      for (let i = 0; i < children.length; i++) {
        // single-cell scalars keep their rowspan stretch
        if (children[i]!.height > 1) {
          children[i] = padHeightWithEmpty(children[i]!, maxHeight);
        }
      }
      return maxHeight;
    }
    for (const child of children) {
      // lcmHeight is divisible by every child height, so scaling is exact
      // and no remainder is left to stretch
      scaleHeightsInPlace(child, Math.floor(lcmHeight / child.height));
    }
    return lcmHeight;
  }

  /** equalizes the columns of one array-item body left after lifting */
  function equalizeBodyHeights(body: Tree<V>): void {
    if (
      body.type !== "row" ||
      !("children" in body) ||
      body.children.length < 2
    ) {
      return;
    }
    const finalHeight = equalizeSiblingHeights(body.children);
    body.height = finalHeight;
  }

  /** renders a header mask as a band tree, dropping undefined holes */
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
    return sizedContainer(isRow ? "row" : "col", children);
  }

  /** copies the seed row widths onto the folded header mask */
  function adoptExtents(
    commonNode: OptionalTree<V>,
    itemNode: OptionalTree<V>,
  ): void {
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
        adoptExtents(commonNode.children[i], itemNode.children[i]);
      }
    }
  }

  /** counts header/corner nodes without allocating an extracted copy */
  function countKindNodes(node: OptionalTree<V>): number {
    if (node === undefined) {
      return 0;
    }
    if (!("children" in node)) {
      return node.type === "header" || node.type === "corner" ? 1 : 0;
    }
    let count = 0;
    for (const child of node.children) {
      count += countKindNodes(child);
    }
    return count > 0 ? 1 + count : 0;
  }

  /** lifts the header band common to all rows on top of the table; with
   * `indexed`, each body gets a fresh index cell, otherwise rows carry
   * their own (collapsed) indexes */
  function stackRowsWithHeaders(
    rows: Tree<V>[],
    value: V[],
    indexed: boolean,
  ): Tree<V>[] {
    const seed =
      deduplicateHeaders === false || rows.length === 0
        ? undefined
        : extractComponentTree(rows[0]!, DEDUP_KINDS);
    let common: OptionalTree<V> = seed;
    for (let i = 1; i < rows.length; i++) {
      common = extractSubtree(rows[i]!, common);
      if (common === undefined) {
        break;
      }
    }
    // Heterogeneous rows share only part of the band: lifting it would
    // mislead, so keep per-row headers instead.
    if (common !== undefined) {
      let fullest = seed === undefined ? 0 : countKindNodes(rows[0]!);
      for (let i = 1; i < rows.length; i++) {
        fullest = max(fullest, countKindNodes(rows[i]!));
      }
      if (countKindNodes(common) < fullest) {
        common = undefined;
      }
    }
    if (common !== undefined) {
      adoptExtents(common, rows[0]);
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
    const headerBlock = sizedContainer("row", [corner, commonBand]);
    const out: Tree<V>[] = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      const body = decapitateTree(rows[i]!, common, DEDUP_KINDS);
      if (
        !indexed &&
        "children" in body &&
        body.children[0]?.type === "index"
      ) {
        // A lifted band shrinks the body: resize its leading collapsed
        // index to the remaining height.
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
    // Widths are grid units sized by content at render time, so narrow
    // items are never scaled: short rows get a trailing blank instead.
    // (Lifting below is width-blind, hence unaffected.)
    const items = value.map((v) => parseValue(v, true));
    const rows = stackRowsWithHeaders(items, value, true);
    let rowWidth = 1;
    for (const row of rows) {
      rowWidth = max(rowWidth, row.width);
    }
    for (let i = 0; i < rows.length; i++) {
      rows[i] = fitRowWidth(rows[i]!, rowWidth);
    }
    return rows;
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
          makeIndexedRow(
            `${prefix}${title}` as LeafValue<V>,
            parseValue(v, true),
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
    // a single-element array renders exactly as its only element:
    // an index column for one row carries no information
    if (value.length === 1) {
      return parseValue(value[0]!, true);
    }
    if (joinPrimitiveArrayValues) {
      const isPrimitives = value.every((v) => isJsonPrimitive(v as JSONValue));
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
      if (value.every(isPlainObject)) {
        const stabilize = makePropertiesStabilizer<V>();
        value = value.map((item) => {
          const { entries, reordered } = stabilize(item as Record<string, V>);
          if (!reordered) {
            return item;
          }
          const stabilized: Record<string, V> = {};
          for (const { key, value: v } of entries) {
            stabilized[key] = v;
          }
          return stabilized as unknown as V;
        });
      }
    }
    const children: Tree<V>[] = collapseIndexes
      ? stackRowsWithHeaders(collapseRows(value, ""), value, false)
      : dedupIndexedRows(value);
    if (children.length === 1) {
      return children[0]!;
    }
    return sizedContainer("col", children);
  }

  function parseValue(value: V, insideArrayItem = false): Tree<V> {
    if (isObject(value)) {
      if (
        TO_TABLE in value &&
        typeof value[TO_TABLE as keyof object] === "function"
      ) {
        return (value as unknown as { [TO_TABLE]: () => Tree<V> })[TO_TABLE]();
      }
      if ("toJSON" in value && typeof value["toJSON"] === "function") {
        return parseValue(value.toJSON() as V, insideArrayItem);
      }
      if (isRecordProto(value)) {
        return transformRecord(
          value as Record<PropertyKey, V>,
          insideArrayItem,
        );
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

  return parseValue;
}
