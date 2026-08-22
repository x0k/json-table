import { describe, expect, it } from "vitest";

import { max, sum } from "@json-table/core/lib/math";
import type { Tree } from "@json-table/core";

import { calculateSheetData } from "./tree-to-xlsx";

describe("json-table-xlsx", () => {
  describe("calculateSheetData", () => {
    it("Should calculate sheet data", () => {
      const tree: Tree<unknown> = {
        type: "row",
        width: 4,
        height: 3,
        children: [
          {
            type: "col",
            width: 1,
            height: 3,
            children: [
              { type: "header", value: "a", width: 1, height: 1 },
              { type: "leaf", value: 1, width: 1, height: 1 },
            ],
          },
          {
            type: "col",
            width: 1,
            height: 3,
            children: [
              { type: "header", value: "b", width: 1, height: 1 },
              { type: "leaf", value: 2, width: 1, height: 1 },
            ],
          },
          {
            type: "col",
            width: 2,
            height: 3,
            children: [
              {
                type: "row",
                width: 2,
                height: 1,
                children: [{ type: "header", value: "c", width: 1, height: 1 }],
              },
              {
                type: "row",
                width: 2,
                height: 1,
                children: [
                  { type: "header", value: "aa", width: 1, height: 1 },
                  { type: "header", value: "bb", width: 1, height: 1 },
                ],
              },
              {
                type: "row",
                width: 2,
                height: 1,
                children: [
                  { type: "leaf", value: 11, width: 1, height: 1 },
                  { type: "leaf", value: 22, width: 1, height: 1 },
                ],
              },
            ],
          },
        ],
      };
      const expected = {
        widths: [8, 8, 8, 8],
        heights: [22, 22, 22],
        cells: [
          {
            height: 1,
            width: 1,
            type: "header",
            value: { value: "a", row: 1, col: 1 },
          },
          {
            height: 2,
            width: 1,
            type: "leaf",
            value: { value: 1, row: 2, col: 1 },
          },
          {
            height: 1,
            width: 1,
            type: "header",
            value: { value: "b", row: 1, col: 2 },
          },
          {
            height: 2,
            width: 1,
            type: "leaf",
            value: { value: 2, row: 2, col: 2 },
          },
          {
            height: 1,
            width: 2,
            type: "header",
            value: { value: "c", row: 1, col: 3 },
          },
          {
            height: 1,
            width: 1,
            type: "header",
            value: { value: "aa", row: 2, col: 3 },
          },
          {
            height: 1,
            width: 1,
            type: "header",
            value: { value: "bb", row: 2, col: 4 },
          },
          {
            height: 1,
            width: 1,
            type: "leaf",
            value: { value: 11, row: 3, col: 3 },
          },
          {
            height: 1,
            width: 1,
            type: "leaf",
            value: { value: 22, row: 3, col: 4 },
          },
        ],
      };
      expect(
        calculateSheetData(tree, {
          columnWidth: (counts) =>
            Math.max(
              Math.ceil(
                (counts.reduce(sum) / tree.height + counts.reduce(max)) / 2
              ),
              8
            ),
          rowHeight: (counts) =>
            Math.max(
              Math.ceil(counts.reduce(sum) / tree.width),
              22
            ),
        })
      ).toEqual(expected);
    });
  });
});
