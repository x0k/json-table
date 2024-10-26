import { describe, it, expect } from 'vitest'

import { type Block, CellType } from "../json-table.js";
import {
  stretchCellsToBottomInPlace,
  stretchCellsToRightInPlace,
  makeBlockInPlaceScaler,
  areBlocksEqual,
} from "./block.js";

describe("stretchCellsToBottom", () => {
  it("Should work with shifted bottom cell", () => {
    const data: Block = {
      height: 2,
      width: 3,
      data: {
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
        indexes: [0, 1],
      },
    };
    const expected: Block = {
      height: 2,
      width: 3,
      data: {
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
        indexes: [0, 1],
      },
    };
    stretchCellsToBottomInPlace(data);
    expect(data).toEqual(expected);
  });
});

describe("stretchCellsToRight", () => {
  it("Should work with shifted right cell", () => {
    const data: Block = {
      height: 3,
      width: 2,
      data: {
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
        indexes: [0, 1, 2],
      },
    };
    const expected: Block = {
      height: 3,
      width: 2,
      data: {
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
        indexes: [0, 1, 2],
      },
    };
    stretchCellsToRightInPlace(data);
    expect(data).toEqual(expected);
  });
});

describe("makeBlockScaler", () => {
  it("Should scale correctly height and fill empty cells", () => {
    const scale = makeBlockInPlaceScaler("height", 5);
    const data: Block = {
      height: 2,
      width: 2,
      data: {
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
              {
                height: 1,
                width: 1,
                value: 4,
                type: CellType.Value,
              },
            ],
            columns: [0, 1],
          },
        ],
        indexes: [0, 1],
      },
    };
    const expected: Block = {
      height: 5,
      width: 2,
      data: {
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
                height: 2,
                width: 1,
                value: 2,
                type: CellType.Value,
              },
            ],
            columns: [0, 1],
          },
          {
            cells: [
              {
                height: 3,
                width: 1,
                value: 3,
                type: CellType.Value,
              },
              {
                height: 3,
                width: 1,
                value: 4,
                type: CellType.Value,
              },
            ],
            columns: [0, 1],
          },
        ],
        indexes: [0, 2],
      },
    };
    scale(data);
    expect(data).toEqual(expected);
  });
});

describe("areBlocksEqual", () => {
  it("Should return true for equal blocks", () => {
    expect(
      areBlocksEqual({
        blocks: [
          {
            height: 1,
            width: 2,
            data: {
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
                  ],
                  columns: [0, 1],
                },
              ],
              indexes: [0],
            },
          },
          {
            height: 2,
            width: 4,
            data: {
              rows: [
                {
                  cells: [
                    {
                      height: 2,
                      width: 2,
                      value: 1,
                      type: CellType.Value,
                    },
                    {
                      height: 2,
                      width: 2,
                      value: 2,
                      type: CellType.Value,
                    },
                  ],
                  columns: [0, 2],
                },
              ],
              indexes: [0],
            },
          },
        ],
        height: 2,
        width: 4,
      })
    ).toBe(true);
  });

  it("Should return false for unequal blocks", () => {
    expect(
      areBlocksEqual({
        blocks: [
          {
            height: 1,
            width: 2,
            data: {
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
                  ],
                  columns: [0, 1],
                },
              ],
              indexes: [0],
            },
          },
          {
            height: 1,
            width: 3,
            data: {
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
              ],
              indexes: [0],
            },
          },
        ],
        width: 6,
        height: 1,
      })
    ).toBe(false);
  });

  it("Should return true for equal blocks with different sizes", () => {
    expect(
      areBlocksEqual({
        blocks: [
          {
            height: 1,
            width: 2,
            data: {
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
                  ],
                  columns: [0, 1],
                },
              ],
              indexes: [0],
            },
          },
          {
            height: 1,
            width: 3,
            data: {
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
                      width: 2,
                      value: 2,
                      type: CellType.Value,
                    },
                  ],
                  columns: [0, 1],
                },
              ],
              indexes: [0],
            },
          },
        ],
        width: 3,
        widthIsLcm: false,
        height: 1,
      })
    ).toBe(true);
  });
});
