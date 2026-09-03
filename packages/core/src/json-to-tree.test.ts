import { describe, expect, it } from "vitest";

import type { JSONValue } from "./lib/json";
import {
  decapitateTree,
  extractHeadersTree,
  extractSubtree,
  rows,
  stretchLeavesDimensionInPlace,
  Tree,
} from "./model";
import { makeTreeFactory } from "./json-to-tree";
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
    ).toEqual([
      ["h@0,0 1x1", "tall@1,0 1x2"],
      ["v@0,1 1x1"],
    ]);
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

describe("extractHeadersTree", () => {
  it("should extract headers tree", () => {
    expect(
      extractHeadersTree(makeTree({ foo: "bar", baz: { a: "b" } })),
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

describe("extractSubtree", () => {
  it("should extract subtree", () => {
    const tree = makeTree({ foo: "bar", baz: { a: "b" } });
    const mask = extractHeadersTree(makeTree({ foo: "bar", baz: "ddd" }));
    expect(extractSubtree(tree, mask)).toEqual({
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
    const mask = extractHeadersTree(tree);
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
