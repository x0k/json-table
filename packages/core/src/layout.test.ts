import { describe, expect, it } from "vitest";

import { JSONValue } from "./lib/json";
import {
  cells,
  decapitateTree,
  extractHeadersTree,
  extractSubtree,
  makeTreeFactory,
  stretchLeavesDimensionInPlace,
  Tree,
} from "./layout";

const makeTree = makeTreeFactory<JSONValue>({
  cornerCellValue: "#",
  createHeader: (k) => k,
  createIndex: (i) => `${i + 1}`,
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

  it("should flatten rows and columns during transformation", () => {
    expect(makeTree({ a: { b: "c" }, d: "e" })).toEqual({
      children: [
        {
          children: [
            {
              height: 1,
              type: "header",
              value: "a",
              width: 1,
            },
            {
              height: 1,
              type: "header",
              value: "b",
              width: 1,
            },
            {
              height: 1,
              type: "leaf",
              value: "c",
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
              value: "d",
              width: 1,
            },
            {
              height: 1,
              type: "leaf",
              value: "e",
              width: 1,
            },
          ],
          height: 2,
          type: "col",
          width: 1,
        },
      ],
      height: 3,
      type: "row",
      width: 2,
    });
  });

  it("should handle empty arrays and objects", () => {
    expect(makeTree([])).toEqual({
      height: 1,
      type: "leaf",
      value: "#",
      width: 1,
    });
    expect(makeTree({})).toEqual({
      height: 1,
      type: "leaf",
      value: "#",
      width: 1,
    });
  });

  it("should join primitive array values", () => {
    const makeTree = makeTreeFactory<JSONValue>({
      cornerCellValue: "#",
      createHeader: (k) => k,
      createIndex: (i) => `${i + 1}`,
      joinPrimitiveArrayValues: true,
    });
    expect(makeTree([1, "a", false])).toEqual({
      height: 1,
      type: "leaf",
      value: "1, a, false",
      width: 1,
    });
  });

  it("should combine arrays of objects", () => {
    const makeTree = makeTreeFactory<JSONValue>({
      cornerCellValue: "#",
      createHeader: (k) => k,
      createIndex: (i) => `${i + 1}`,
      combineArraysOfObjects: true,
    });
    expect(makeTree([{ a: 1 }, { b: 2 }])).toEqual({
      children: [
        {
          children: [
            { height: 1, type: "header", value: "a", width: 1 },
            { height: 1, type: "leaf", value: 1, width: 1 },
          ],
          height: 2,
          type: "col",
          width: 1,
        },
        {
          children: [
            { height: 1, type: "header", value: "b", width: 1 },
            { height: 1, type: "leaf", value: 2, width: 1 },
          ],
          height: 2,
          type: "col",
          width: 1,
        },
      ],
      height: 2,
      type: "row",
      width: 2,
    });
  });

  it("should stabilize order of properties in arrays of objects", () => {
    const tree = makeTree([
      { b: 1, a: 2 },
      { a: 3, b: 4 },
    ]);
    expect([...cells(tree)].map(({ node }) => node.value)).toEqual([
      "#",
      "b",
      "#",
      "a",
      "#",
      "1",
      1,
      2,
      "2",
      4,
      3,
    ]);
  });

  it("should collapse indexes", () => {
    const makeTree = makeTreeFactory<JSONValue>({
      cornerCellValue: "#",
      createHeader: (k) => k,
      createIndex: (i) => `${i + 1}`,
      collapseIndexes: true,
    });
    expect([...cells(makeTree([[1, 2], [3, 4]]))].map(({ node }) => node.value))
      .toEqual(["1.1", 1, "1.2", 2, "2.1", 3, "2.2", 4]);
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
          height: 2,
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
              height: 1,
              type: "header",
              value: "a",
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
          height: 2,
          type: "col",
          width: 1,
        },
        undefined,
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
    expect(decapitateTree(tree, mask)).toEqual({
      children: [
        {
          height: 1,
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
      height: 1,
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
