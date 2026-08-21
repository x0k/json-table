import { describe, expect, it } from "vitest";

import type { JSONValue } from "../lib/json";
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

import collapsedIndexes from "./__fixtures__/collapsed-indexes.json";
import formatInBothItems from "./__fixtures__/format-in-both-items.json";
import fullyDeduplicated from "./__fixtures__/fully-deduplicated.json";
import multilineHeaders from "./__fixtures__/multiline-headers.json";
import nestedArrays from "./__fixtures__/nested-arrays.json";
import objects from "./__fixtures__/objects.json";
import partiallyDifferentHeaders from "./__fixtures__/partially-different-headers.json";
import primitivesFixture from "./__fixtures__/primitives.json";
import simpleHeadersDuplication from "./__fixtures__/simple-headers-duplication.json";
import wrongSizes from "./__fixtures__/wrong-sizes.json";

const makeTree = makeTreeFactory<JSONValue>({
  cornerCellValue: "#",
  createHeader: (k) => k,
  createIndex: (i) => `${i + 1}`,
});

interface RenderFixture {
  name: string;
  options: Record<string, unknown>;
  input: JSONValue;
}

const renderFixtures: RenderFixture[] = [
  objects,
  nestedArrays,
  collapsedIndexes,
  simpleHeadersDuplication,
  multilineHeaders,
  partiallyDifferentHeaders,
  wrongSizes,
  fullyDeduplicated,
  formatInBothItems,
] as unknown as RenderFixture[];

describe.each(renderFixtures)("$name", ({ name, options, input }) => {
  it("renders expected table", () => {
    const factory = makeTreeFactory<JSONValue>({
      cornerCellValue: "#",
      createHeader: (k: string) => k,
      createIndex: (i: number) => `${i + 1}`,
      ...options,
    } as never);
    const tree = factory(input);
    stretchLeavesDimensionInPlace(tree, "height");
    expect(`\n${matrixToASCII(treeToMatrix(tree))}\n`).toMatchSnapshot(name);
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
    const data = primitivesFixture.input;
    for (const value of data) {
      expect(makeTree(value)).toEqual({
        type: "leaf",
        value,
        width: 1,
        height: 1,
      });
      const ascii = matrixToASCII(treeToMatrix(makeTree(value)));
      expect(`\n${ascii}`).toMatchSnapshot(`primitive ${String(value)}`);
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
    expect(decapitateTree(tree, mask, new Set(["header"]))).toEqual({
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
