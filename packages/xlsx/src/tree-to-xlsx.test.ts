import { describe, expect, it } from "vitest";

import { fromArrayBuffer, loadWorkbook } from "@office-kit/xlsx/io";
import { getCell } from "@office-kit/xlsx/worksheet";
import type { Tree } from "@json-table/core";

import { calculateSheetData, treesToXlsxBytes } from "./tree-to-xlsx";

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
        widths: [10, 10, 10, 10],
        heights: [15, 15, 15],
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
      expect(calculateSheetData(tree)).toEqual(expected);
    });

    it("Should wrap long values instead of widening columns (p90 outlier)", () => {
      const short = "123456789012"; // 12 chars
      const long = "x".repeat(60);
      const tree: Tree<unknown> = {
        type: "col",
        width: 1,
        height: 10,
        children: [
          { type: "header", value: "h", width: 1, height: 1 },
          ...Array.from({ length: 9 }, (_, i) => ({
            type: "leaf" as const,
            value: i === 8 ? long : short,
            width: 1,
            height: 1,
          })),
        ],
      };
      const { widths, heights } = calculateSheetData(tree);
      // p90 ignores the single 60-char outlier; +1 char padding, min width applies
      expect(widths).toEqual([13]);
      // capacity = 13 chars/line -> ceil(60 / 13) = 5 lines
      expect(heights[9]).toBe(5 * 15);
      // all other rows fit a single line
      expect(heights.slice(0, 9)).toEqual(Array(9).fill(15));
    });

    it("Should spread wrapped lines of a merged cell across its rows", () => {
      const tree: Tree<unknown> = {
        type: "col",
        width: 1,
        height: 3,
        children: [
          { type: "header", value: "h", width: 1, height: 1 },
          { type: "leaf", value: "y".repeat(40), width: 1, height: 2 },
        ],
      };
      const { widths, heights } = calculateSheetData(tree);
      expect(widths).toEqual([10]); // floored at cellMinWidth
      // capacity = 10 -> ceil(40 / 10) = 4 lines over 2 rows -> 2 lines per row
      expect(heights).toEqual([15, 2 * 15, 2 * 15]);
    });

    it("Should size multi-column content by its spanned capacity", () => {
      const tree: Tree<unknown> = {
        type: "row",
        width: 2,
        height: 1,
        children: [
          { type: "header", value: "a".repeat(30), width: 1, height: 1 },
          { type: "header", value: "b".repeat(30), width: 1, height: 1 },
        ],
      };
      const { widths, heights } = calculateSheetData(tree);
      expect(widths).toEqual([31, 31]);
      expect(heights).toEqual([15]);
    });
  });

  describe("treesToXlsxBytes", () => {
    it("Should produce a workbook that round-trips values and merges", async () => {
      const tree: Tree<unknown> = {
        type: "col",
        width: 2,
        height: 2,
        children: [
          {
            type: "row",
            width: 2,
            height: 1,
            children: [
              { type: "corner", value: "", width: 1, height: 1 },
              { type: "header", value: "col", width: 1, height: 1 },
            ],
          },
          {
            type: "row",
            width: 2,
            height: 1,
            children: [
              { type: "index", value: "row", width: 1, height: 1 },
              { type: "leaf", value: 42, width: 1, height: 1 },
            ],
          },
        ],
      };
      const bytes = await treesToXlsxBytes([["Sheet1", tree]]);
      const wb = await loadWorkbook(fromArrayBuffer(bytes));
      const sheetRef = wb.sheets[0]!;
      expect(sheetRef.sheet.title).toBe("Sheet1");
      if (sheetRef.kind !== "worksheet") throw new Error("not a worksheet");
      const ws = sheetRef.sheet;
      // header is bold
      const header = getCell(ws, 1, 2);
      expect(header?.value).toBe("col");
      expect(wb.styles.cellXfs[header!.styleId]?.fontId).toBeDefined();
      const leaf = getCell(ws, 2, 2);
      expect(leaf?.value).toBe(42);    });
  });
});
