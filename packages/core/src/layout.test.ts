import { describe, expect, it } from "vitest";

import { JSONValue } from "./lib/json";
import {
  decapitateTree,
  extractHeadersTree,
  extractSubtree,
  makeTreeFactory,
  stretchLeavesHeight,
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
    expect(stretchLeavesHeight(tree)).toEqual({
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
