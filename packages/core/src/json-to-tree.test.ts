import { describe, expect, it } from "vitest";

import type { JSONValue } from "./lib/json";
import {
  cells,
  decapitateTree,
  extractComponentTree,
  intersectTrees,
  HEAD_KINDS,
  rows,
  stretchLeavesDimensionInPlace,
  Tree,
} from "./model";
import { joinPrimitiveArrayValues, makeTreeFactory } from "./json-to-tree";
import { makePropertiesStabilizer } from "./properties-stabilizer";

const makeTree = makeTreeFactory<JSONValue>({
  cornerCellValue: "#",
  createHeader: (k) => k,
  createIndex: (i) => `${i + 1}`,
});

describe("makePropertiesStabilizer", () => {
  it("orders entries by stable first-seen position", () => {
    const stabilize = makePropertiesStabilizer<string>();
    const first = stabilize({ b: "1", a: "2" });
    expect(first.entries.map((e) => e.key)).toEqual(["b", "a"]);
    expect(first.reordered).toBe(false);
    const second = stabilize({ c: "3", a: "4" });
    expect(second.entries.map((e) => e.key)).toEqual(["a", "c"]);
    expect(second.reordered).toBe(true);
    const third = stabilize({ b: "0", c: "5", a: "6" });
    expect(third.entries.map((e) => e.key)).toEqual(["b", "a", "c"]);
    expect(third.reordered).toBe(true);
  });
});

describe("rows", () => {
  it("groups cells into gap-free left-ordered visual rows", () => {
    // 2x2 table: col[header "h", leaf "v"] beside a tall leaf
    const tree: Tree<JSONValue> = {
      type: "row",
      width: 2,
      height: 2,
      children: [
        {
          type: "col",
          width: 1,
          height: 2,
          children: [
            { type: "header", value: "h", width: 1, height: 1 },
            { type: "leaf", value: "v", width: 1, height: 1 },
          ],
        },
        { type: "leaf", value: "tall", width: 1, height: 2 },
      ],
    };
    const result = rows(tree);
    expect(result.length).toBe(tree.height);
    expect(
      result.map((row) =>
        row.map((c) => `${c.node.value}@${c.x},${c.y} ${c.width}x${c.height}`),
      ),
    ).toEqual([["h@0,0 1x1", "tall@1,0 1x2"], ["v@0,1 1x1"]]);
  });

  it("yields an empty row when it is fully covered by rowspans", () => {
    const tree: Tree<JSONValue> = {
      type: "col",
      width: 1,
      height: 2,
      children: [{ type: "leaf", value: 1, width: 1, height: 2 }],
    };
    const result = rows(tree);
    expect(result.map((row) => row.length)).toEqual([1, 0]);
  });

  it("yields cells in ascending x order per row for nested layouts", () => {
    // row[ col[ row[a,b], c ], col[d, col[e,f]] ]
    const leaf = (value: number): Tree<JSONValue> => ({
      type: "leaf",
      value,
      width: 1,
      height: 1,
    });
    const tree: Tree<JSONValue> = {
      type: "row",
      width: 4,
      height: 3,
      children: [
        {
          type: "col",
          width: 2,
          height: 3,
          children: [
            {
              type: "row",
              width: 2,
              height: 1,
              children: [leaf(0), leaf(1)],
            },
            leaf(2),
          ],
        },
        {
          type: "col",
          width: 2,
          height: 3,
          children: [
            leaf(3),
            {
              type: "col",
              width: 2,
              height: 2,
              children: [
                {
                  type: "row",
                  width: 2,
                  height: 1,
                  children: [leaf(4), leaf(5)],
                },
                leaf(6),
              ],
            },
          ],
        },
      ],
    };
    for (const row of rows(tree)) {
      const xs = row.map((cell) => cell.x);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    }
  });
});

describe("makeTreeFactory", () => {
  it("should make tree", () => {
    expect(makeTree({ foo: "foo" })).toEqual({
      children: [
        {
          height: 1,
          type: "header",
          value: "foo",
          width: 1,
        },
        {
          height: 1,
          type: "leaf",
          value: "foo",
          width: 1,
        },
      ],
      height: 2,
      type: "col",
      width: 1,
    });
  });

  it("Should create tree for primitives", () => {
    for (const value of [false, 12345, "abcde"]) {
      expect(makeTree(value)).toEqual({
        type: "leaf",
        value,
        width: 1,
        height: 1,
      });
    }
  });

  it("should unwrap toJSON values", () => {
    const tree = makeTree({
      date: { toJSON: () => "2026-08-21" } as unknown as JSONValue,
    });
    stretchLeavesDimensionInPlace(tree, "height");
    if (!("children" in tree)) {
      throw new Error("expected a branch node");
    }
    expect(tree.children[1]).toMatchObject({
      type: "leaf",
      value: "2026-08-21",
    });
  });
});

describe("extractComponentTree", () => {
  it("should extract headers tree", () => {
    expect(
      extractComponentTree(
        makeTree({ foo: "bar", baz: { a: "b" } }),
        HEAD_KINDS,
      ),
    ).toEqual({
      children: [
        {
          children: [
            {
              height: 1,
              type: "header",
              value: "foo",
              width: 1,
            },
            undefined,
          ],
          height: 3,
          type: "col",
          width: 1,
        },
        {
          children: [
            {
              height: 1,
              type: "header",
              value: "baz",
              width: 1,
            },
            {
              children: [
                {
                  height: 1,
                  type: "header",
                  value: "a",
                  width: 1,
                },
                undefined,
              ],
              height: 2,
              type: "col",
              width: 1,
            },
          ],
          height: 3,
          type: "col",
          width: 1,
        },
      ],
      height: 3,
      type: "row",
      width: 2,
    });
  });
});

describe("intersectTrees", () => {
  it("should extract subtree", () => {
    const tree = makeTree({ foo: "bar", baz: { a: "b" } });
    const mask = extractComponentTree(
      makeTree({ foo: "bar", baz: "ddd" }),
      HEAD_KINDS,
    );
    expect(intersectTrees(tree, mask, (a, b) => a === b)).toEqual({
      children: [
        {
          children: [
            {
              height: 1,
              type: "header",
              value: "foo",
              width: 1,
            },
            undefined,
          ],
          height: 3,
          type: "col",
          width: 1,
        },
        {
          children: [
            {
              height: 1,
              type: "header",
              value: "baz",
              width: 1,
            },
            undefined,
          ],
          height: 3,
          type: "col",
          width: 1,
        },
      ],
      height: 3,
      type: "row",
      width: 2,
    });
  });
});

describe("decapitateTree", () => {
  it("should omit header nodes", () => {
    const tree = makeTree({ foo: "bar", baz: { a: "b" } });
    const mask = extractComponentTree(tree, HEAD_KINDS);
    expect(decapitateTree(tree, mask, new Set(["header"]))).toEqual({
      children: [
        {
          height: 2,
          type: "leaf",
          value: "bar",
          width: 1,
        },
        {
          height: 1,
          type: "leaf",
          value: "b",
          width: 1,
        },
      ],
      height: 2,
      type: "row",
      width: 2,
    });
  });
});

describe("stretchLeavesHeight", () => {
  it("should stretch height of lowest leaves", () => {
    const tree: Tree<JSONValue> = {
      type: "row",
      height: 3,
      width: 3,
      children: [
        {
          type: "col",
          height: 2,
          width: 1,
          children: [
            {
              type: "header",
              height: 1,
              width: 1,
              value: "h1",
            },
            {
              type: "leaf",
              height: 1,
              width: 1,
              value: "v1",
            },
          ],
        },
        {
          type: "col",
          height: 2,
          width: 1,
          children: [
            {
              type: "header",
              height: 1,
              width: 1,
              value: "h2",
            },
            {
              type: "leaf",
              height: 1,
              width: 1,
              value: "v2",
            },
          ],
        },
        {
          type: "col",
          height: 3,
          width: 1,
          children: [
            {
              type: "header",
              height: 1,
              width: 1,
              value: "h3",
            },
            {
              type: "col",
              height: 2,
              width: 1,
              children: [
                {
                  type: "header",
                  height: 1,
                  width: 1,
                  value: "h4",
                },
                {
                  type: "leaf",
                  height: 1,
                  width: 1,
                  value: "v3",
                },
              ],
            },
          ],
        },
      ],
    };
    stretchLeavesDimensionInPlace(tree, "height");
    expect(tree).toEqual({
      children: [
        {
          children: [
            {
              height: 1,
              type: "header",
              value: "h1",
              width: 1,
            },
            {
              height: 2,
              type: "leaf",
              value: "v1",
              width: 1,
            },
          ],
          height: 3,
          type: "col",
          width: 1,
        },
        {
          children: [
            {
              height: 1,
              type: "header",
              value: "h2",
              width: 1,
            },
            {
              height: 2,
              type: "leaf",
              value: "v2",
              width: 1,
            },
          ],
          height: 3,
          type: "col",
          width: 1,
        },
        {
          children: [
            {
              height: 1,
              type: "header",
              value: "h3",
              width: 1,
            },
            {
              children: [
                {
                  height: 1,
                  type: "header",
                  value: "h4",
                  width: 1,
                },
                {
                  height: 1,
                  type: "leaf",
                  value: "v3",
                  width: 1,
                },
              ],
              height: 2,
              type: "col",
              width: 1,
            },
          ],
          height: 3,
          type: "col",
          width: 1,
        },
      ],
      height: 3,
      type: "row",
      width: 3,
    });
  });
});

describe("isHeaderEqual", () => {
  interface LabeledHeader {
    label: string;
  }

  const createLabeledHeader = (k: string): LabeledHeader => ({ label: k });
  const isLabeledHeaderEqual = (a: unknown, b: unknown): boolean =>
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null &&
    (a as LabeledHeader).label === (b as LabeledHeader).label;

  const collapsedDepartments = [
    { name: "Research", employees: "2 items" },
    { name: "Development", employees: "2 items" },
    { name: "Marketing", employees: "2 items" },
  ];

  function bandCounts(tree: Tree<unknown>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const { node } of cells(tree)) {
      if (node.type === "header" || node.type === "corner") {
        counts[node.type] = (counts[node.type] ?? 0) + 1;
      }
    }
    return counts;
  }

  it("lifts bands whose headers match by custom equality", () => {
    const createTree = makeTreeFactory<unknown>({
      cornerCellValue: "#",
      createHeader: createLabeledHeader,
      createIndex: (i) => `${i + 1}`,
      isHeaderEqual: isLabeledHeaderEqual,
    });
    expect(bandCounts(createTree(collapsedDepartments))).toEqual({
      corner: 1,
      header: 2,
    });
  });

  it("keeps per-row bands without it", () => {
    const createTree = makeTreeFactory<unknown>({
      cornerCellValue: "#",
      createHeader: createLabeledHeader,
      createIndex: (i) => `${i + 1}`,
    });
    expect(bandCounts(createTree(collapsedDepartments))).toEqual({
      header: 6,
    });
  });

  it("still splits on structural mismatch", () => {
    const createTree = makeTreeFactory<unknown>({
      cornerCellValue: "#",
      createHeader: createLabeledHeader,
      createIndex: (i) => `${i + 1}`,
      isHeaderEqual: isLabeledHeaderEqual,
    });
    const tree = createTree([
      ...collapsedDepartments,
      { name: "X", employees: { a: 1 } },
    ]);
    expect(bandCounts(tree)).toEqual({ header: 9 });
  });
});

describe("factory options", () => {
  const baseOptions = {
    cornerCellValue: "#",
    createHeader: (k: string) => k,
    createIndex: (i: number) => `${i + 1}`,
  } as const;

  function leafValues(tree: Tree<JSONValue>): unknown[] {
    const out: unknown[] = [];
    for (const { node } of cells(tree)) {
      if (node.type === "leaf") {
        out.push(node.value);
      }
    }
    return out;
  }

  it("createLeaf formats data leaves, headers and indexes pass through", () => {
    const createTree = makeTreeFactory<JSONValue>({
      ...baseOptions,
      createLeaf: (v) => (typeof v === "number" ? `#${v}` : v),
    });
    expect(leafValues(createTree({ n: 42, s: "x" }))).toEqual(["#42", "x"]);
  });

  it("joinArrayValues joins with a custom function", () => {
    const createTree = makeTreeFactory<JSONValue>({
      ...baseOptions,
      joinArrayValues: (values) => values.join(" | "),
    });
    expect(leafValues(createTree({ a: [1, 2] }))).toEqual(["1 | 2"]);
  });

  it("joinArrayValues then createLeaf see the joined string", () => {
    const seen: unknown[] = [];
    const createTree = makeTreeFactory<JSONValue>({
      ...baseOptions,
      joinArrayValues: (values) => values.join(", "),
      createLeaf: (v) => {
        seen.push(v);
        return v;
      },
    });
    expect(leafValues(createTree({ a: [1, 2] }))).toEqual(["1, 2"]);
    expect(seen).toEqual(["1, 2"]);
  });

  it("joinArrayValues merges object arrays, declining renders a table", () => {
    const merged = makeTreeFactory<JSONValue>({
      ...baseOptions,
      joinArrayValues: (values) => `${values.length} objects`,
    })({ a: [{ x: 1 }, { x: 2 }] });
    expect(leafValues(merged)).toEqual(["2 objects"]);
    const declined = makeTreeFactory<JSONValue>({
      ...baseOptions,
      joinArrayValues: () => undefined,
    })({ a: [{ x: 1 }, { x: 2 }] });
    const declinedLeaves = leafValues(declined);
    expect(declinedLeaves).toContain(1);
    expect(declinedLeaves).toContain(2);
    expect(declined.height).toBeGreaterThan(1);
  });

  it("joinPrimitiveArrayValues joins primitives and declines the rest", () => {
    const join = joinPrimitiveArrayValues as (values: JSONValue[]) => unknown;
    expect(join([1, "two", false])).toBe("1, two, false");
    expect(join([{ x: 1 }])).toBeUndefined();
  });

  it("isProportionalResize guard selects scaling versus padding", () => {
    // Short body (2 rows) against a target of 5: allowed scaling doubles
    // it with a 1-row remainder, rejection pads the whole deficit of 3.
    // (Band heights cancel out, so only these numbers can result.)
    const input = {
      tall: [{ n: "a" }, { n: "b" }, { n: "c" }, { n: "d" }, { n: "e" }],
      short: [{ t: 1 }, { t: 2 }],
    } as unknown as JSONValue;
    const fillerHeights = (tree: Tree<JSONValue>): number[] => {
      const out: number[] = [];
      for (const { node } of cells(tree)) {
        if (node.type === "leaf" && node.value === "") {
          out.push(node.height);
        }
      }
      return out;
    };
    const scaled = makeTreeFactory<JSONValue>({
      ...baseOptions,
      collapseIndexes: true,
      isProportionalResize: () => true,
    })(input);
    const padded = makeTreeFactory<JSONValue>({
      ...baseOptions,
      collapseIndexes: true,
      isProportionalResize: () => false,
    })(input);
    expect(fillerHeights(scaled)).toEqual([1]);
    expect(fillerHeights(padded)).toEqual([3]);
  });

  it("emptyCellValue customizes gap filler", () => {
    // Deficit (1) smaller than the short body (3 rows): no scaling either
    // way, the remainder is the only filler in the tree.
    const createTree = makeTreeFactory<JSONValue>({
      ...baseOptions,
      collapseIndexes: true,
      emptyCellValue: () => "—",
    });
    const tree = createTree({
      tall: [{ n: "a" }, { n: "b" }, { n: "c" }, { n: "d" }],
      short: [{ t: 1 }, { t: 2 }, { t: 3 }],
    } as unknown as JSONValue);
    expect(leafValues(tree)).toContain("—");
    expect(leafValues(tree)).not.toContain("");
  });

  it("emptyCellValue covers empty arrays verbatim, bypassing createLeaf", () => {
    const seen: unknown[] = [];
    const createTree = makeTreeFactory<JSONValue>({
      cornerCellValue: "#",
      createHeader: (k: string) => k,
      createIndex: (i: number) => `${i + 1}`,
      emptyCellValue: () => "—",
      createLeaf: (v) => {
        seen.push(v);
        return v;
      },
    });
    expect(leafValues(createTree({ a: [] }))).toEqual(["—"]);
    expect(seen).toEqual([]);
  });

  it("emptyCellValue distinguishes gap filler from empty arrays", () => {
    const createTree = makeTreeFactory<JSONValue>({
      ...baseOptions,
      collapseIndexes: true,
      emptyCellValue: ({ type }) => (type === "empty-array" ? "∅" : "—"),
    });
    const tree = createTree({
      tall: [{ n: "a" }, { n: "b" }, { n: "c" }, { n: "d" }],
      short: [{ t: 1 }, { t: 2 }, { t: 3 }],
      e: [],
    });
    const values = leafValues(tree);
    expect(values).toContain("—");
    expect(values).toContain("∅");
  });
});
