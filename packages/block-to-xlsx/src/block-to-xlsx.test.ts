import { describe, expect, it } from "vitest";

import { max, sum } from "@json-table/core/lib/math";
import { type Block, CellType } from "@json-table/core";

import { calculateSheetData } from "./block-to-xlsx";

describe("json-table-xlsx", () => {
  describe("calculateSheetData", () => {
    it("Should calculate sheet data", () => {
      const table: Block = {
        width: 4,
        height: 3,
        data: {
          rows: [
            {
              cells: [
                {
                  height: 1,
                  width: 1,
                  value: "a",
                  type: CellType.Header,
                },
                {
                  height: 1,
                  width: 1,
                  value: "b",
                  type: CellType.Header,
                },
                {
                  height: 1,
                  width: 2,
                  value: "c",
                  type: CellType.Header,
                },
              ],
              columns: [0, 1, 2],
            },
            {
              cells: [
                {
                  height: 2,
                  width: 1,
                  value: 1,
                  type: CellType.Value,
                },
                {
                  height: 2,
                  width: 1,
                  value: 2,
                  type: CellType.Value,
                },
                {
                  height: 1,
                  width: 1,
                  value: "aa",
                  type: CellType.Header,
                },
                {
                  height: 1,
                  width: 1,
                  value: "bb",
                  type: CellType.Header,
                },
              ],
              columns: [0, 1, 2, 3],
            },
            {
              cells: [
                {
                  height: 1,
                  width: 1,
                  value: 11,
                  type: CellType.Value,
                },
                {
                  height: 1,
                  width: 1,
                  value: 22,
                  type: CellType.Value,
                },
              ],
              columns: [2, 3],
            },
          ],
          indexes: [0, 1, 2],
        },
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
            height: 1,
            width: 1,
            type: "header",
            value: { value: "b", row: 1, col: 2 },
          },
          {
            height: 1,
            width: 2,
            type: "header",
            value: { value: "c", row: 1, col: 3 },
          },
          {
            height: 2,
            width: 1,
            type: "value",
            value: { value: 1, row: 2, col: 1 },
          },
          {
            height: 2,
            width: 1,
            type: "value",
            value: { value: 2, row: 2, col: 2 },
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
            type: "value",
            value: { value: 11, row: 3, col: 3 },
          },
          {
            height: 1,
            width: 1,
            type: "value",
            value: { value: 22, row: 3, col: 4 },
          },
        ],
      };
      expect(
        calculateSheetData(table, {
          columnWidth: (column) => {
            const counts = column.map((cell) => cell.count);
            return Math.max(
              Math.ceil(
                (counts.reduce(sum) / table.height + counts.reduce(max)) / 2
              ),
              8
            );
          },
          rowHeight: (row) =>
            Math.max(
              Math.ceil(
                row.map(({ count }) => count).reduce(sum) / table.width
              ),
              22
            ),
        })
      ).toEqual(expected);
    });
  });
});
