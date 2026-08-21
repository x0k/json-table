import { describe, expect, it } from "vitest";

import { JSONValue } from "../lib/json";
import { matrixToASCII } from "../block-to-ascii/block-to-ascii";
import {
  decapitateTree,
  extractHeadersTree,
  extractSubtree,
  stretchLeavesDimensionInPlace,
  Tree,
} from "./tree";
import { makeTreeFactory } from "./json-to-tree";
import { treeToMatrix } from "./tree-to-matrix";

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

  it("Should create tree for primitives", () => {
    const data = [false, 12345, "abcde"];
    for (const value of data) {
      expect(makeTree(value)).toEqual({
        type: "leaf",
        value,
        width: 1,
        height: 1,
      });
      const ascii = matrixToASCII(treeToMatrix(makeTree(value)));
      expect(`\n${ascii}`).toBe(`
+-------+
| ${value} |
+-------+`);
    }
  });

  it("Should create tree for objects", () => {
    const data = {
      a: 1,
      b: 2,
      c: { aa: 11, bb: 22 },
    };
    const ascii = matrixToASCII(treeToMatrix(makeTree(data)));
    expect(`\n${ascii}\n`).toBe(`
+---+---+---------+
| a | b |    c    |
+---+---+----+----+
|   |   | aa | bb |
| 1 | 2 +----+----+
|   |   | 11 | 22 |
+---+---+----+----+
`);
  });

  it("Should create tree for arrays", () => {
    const data = [1, 2, [11, 22]];
    const ascii = matrixToASCII(treeToMatrix(makeTree(data)));
    expect(`\n${ascii}\n`).toBe(`
+---+--------+
| 1 |      1 |
+---+--------+
| 2 |      2 |
+---+---+----+
|   | 1 | 11 |
| 3 +---+----+
|   | 2 | 22 |
+---+---+----+
`);
  });

  it("Should create tree for arrays with indexes collapse", () => {
    const factory = makeTreeFactory<JSONValue>({
      cornerCellValue: "#",
      createHeader: (k) => k,
      createIndex: (i) => `${i + 1}`,
      collapseIndexes: true,
    });
    const ascii = matrixToASCII(
      treeToMatrix(
        factory([
          [1, 2],
          [11, 22],
        ]),
      ),
    );
    expect(`\n${ascii}\n`).toBe(`
+-----+----+
| 1.1 |  1 |
+-----+----+
| 1.2 |  2 |
+-----+----+
| 2.1 | 11 |
+-----+----+
| 2.2 | 22 |
+-----+----+
`);
  });

  it("Should deduplicate tree headers", () => {
    const factory = makeTreeFactory<JSONValue>({
      cornerCellValue: "№",
      createHeader: (k) => k,
      createIndex: (i) => `${i + 1}`,
    });
    const ascii = matrixToASCII(
      treeToMatrix(
        factory([
          { a: 1, b: 2, c: 3 },
          { a: 4, b: 5, c: 6 },
          { a: 7, b: 8, c: 9 },
        ]),
      ),
    );
    expect(`\n${ascii}\n`).toBe(`
+---+---+---+---+
| № | a | b | c |
+---+---+---+---+
| 1 | 1 | 2 | 3 |
+---+---+---+---+
| 2 | 4 | 5 | 6 |
+---+---+---+---+
| 3 | 7 | 8 | 9 |
+---+---+---+---+
`);
  });

  it("Should deduplicate multiline tree headers", () => {
    const factory = makeTreeFactory<JSONValue>({
      cornerCellValue: "№",
      createHeader: (k) => k,
      createIndex: (i) => `${i + 1}`,
    });
    const ascii = matrixToASCII(
      treeToMatrix(
        factory([
          { a: { x: 1 }, b: { y: 2 } },
          { a: { x: 3 }, b: { y: 4 } },
        ]),
      ),
    );
    expect(`\n${ascii}\n`).toBe(`
+---+---+---+
|   | a | b |
| № +---+---+
|   | x | y |
+---+---+---+
| 1 | 1 | 2 |
+---+---+---+
| 2 | 3 | 4 |
+---+---+---+
`);
  });

  it("Should deduplicate tree indexes", () => {
    const factory = makeTreeFactory<JSONValue>({
      cornerCellValue: "№",
      createHeader: (k) => k,
      createIndex: (i) => `${i + 1}`,
    });
    const ascii = matrixToASCII(
      treeToMatrix(factory({ a: [1, 4, 7], b: [2, 5, 8], c: [3, 6, 9] })),
    );
    expect(`\n${ascii}\n`).toBe(`
+---+---+---+---+
| № | a | b | c |
+---+---+---+---+
| 1 | 1 | 2 | 3 |
+---+---+---+---+
| 2 | 4 | 5 | 6 |
+---+---+---+---+
| 3 | 7 | 8 | 9 |
+---+---+---+---+
`);
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
    expect(decapitateTree(tree, mask, "header")).toEqual({
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
