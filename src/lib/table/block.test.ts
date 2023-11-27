import { Block, CellType } from "./core";
import { stretchCellsToBottom, stretchCellsToRight } from "./block";

describe("stretchCellsToBottom", () => {
  it("Should work with shifted bottom cell", () => {
    const data: Block = {
      height: 2,
      width: 3,
      rows: [
        {
          cells: [
            {
              height: 1,
              width: 1,
              value: 1,
              type: CellType.Value,
            },
            {
              height: 1,
              width: 1,
              value: 2,
              type: CellType.Value,
            },
            {
              height: 1,
              width: 1,
              value: 3,
              type: CellType.Value,
            },
          ],
          columns: [0, 1, 2],
        },
        {
          cells: [
            {
              height: 1,
              width: 1,
              value: 4,
              type: CellType.Value,
            },
          ],
          columns: [1],
        },
      ],
    };
    const result = stretchCellsToBottom(data);
    const expected: Block = {
      height: 2,
      width: 3,
      rows: [
        {
          cells: [
            {
              height: 2,
              width: 1,
              value: 1,
              type: CellType.Value,
            },
            {
              height: 1,
              width: 1,
              value: 2,
              type: CellType.Value,
            },
            {
              height: 2,
              width: 1,
              value: 3,
              type: CellType.Value,
            },
          ],
          columns: [0, 1, 2],
        },
        {
          cells: [
            {
              height: 1,
              width: 1,
              value: 4,
              type: CellType.Value,
            },
          ],
          columns: [1],
        },
      ],
    };
    expect(result).toEqual(expected);
  });
});

describe("stretchCellsToRight", () => {
  it("Should work with shifted right cell", () => {
    const data: Block = {
      height: 3,
      width: 2,
      rows: [
        {
          cells: [
            {
              height: 1,
              width: 1,
              value: 1,
              type: CellType.Value,
            },
          ],
          columns: [0],
        },
        {
          cells: [
            {
              height: 1,
              width: 1,
              value: 2,
              type: CellType.Value,
            },
            {
              height: 1,
              width: 1,
              value: 4,
              type: CellType.Value,
            },
          ],
          columns: [0, 1],
        },
        {
          cells: [
            {
              height: 1,
              width: 1,
              value: 3,
              type: CellType.Value,
            },
          ],
          columns: [0],
        },
      ],
    };
    const expected: Block = {
      height: 3,
      width: 2,
      rows: [
        {
          cells: [
            {
              height: 1,
              width: 2,
              value: 1,
              type: CellType.Value,
            },
          ],
          columns: [0],
        },
        {
          cells: [
            {
              height: 1,
              width: 1,
              value: 2,
              type: CellType.Value,
            },
            {
              height: 1,
              width: 1,
              value: 4,
              type: CellType.Value,
            },
          ],
          columns: [0, 1],
        },
        {
          cells: [
            {
              height: 1,
              width: 2,
              value: 3,
              type: CellType.Value,
            },
          ],
          columns: [0],
        },
      ],
    };
    expect(stretchCellsToRight(data)).toEqual(expected);
  });
});
