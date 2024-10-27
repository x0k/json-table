import { lcm, max } from "../lib/math.js";

import {
  type Block,
  type BlockCompositor,
  CellType,
  TABLE_COMPONENT_SIZE_ASPECTS,
  TABLE_COMPONENT_OPPOSITES,
  type Table,
  type TableComponent,
  type TableCompositor,
  type ComposedTable,
  type ProportionalResizeGuard,
} from "../json-table.js";

import {
  shiftPositionsInPlace,
  areBlocksEqual,
  makeBlockInPlaceScaler,
  makeHorizontalBlockInPlaceStacker,
  makeVerticalBlockInPlaceStacker,
  mergeBlocksHorizontally,
  mergeBlocksVertically,
} from "../block/index.js";

export function makeTableFromValue<V>(value: V): Table<V> {
  return {
    head: null,
    indexes: null,
    body: {
      height: 1,
      width: 1,
      data: {
        rows: [
          {
            cells: [{ height: 1, width: 1, value, type: CellType.Value }],
            columns: [0],
          },
        ],
        indexes: [0],
      },
    },
  };
}

export interface BakeOptions<V> {
  head?: boolean;
  indexes?: boolean;
  cornerCellValue: V;
}

// TODO: combine into one function `makeComponentSelector(aspect: BlockSizeAspect)`
function bestHead<V>(a: Block<V>, b: Block<V>) {
  if (a.width === b.width) {
    return a.height < b.height ? a : b;
  }
  return a.width > b.width ? a : b;
}

function bestIndexes<V>(a: Block<V>, b: Block<V>) {
  if (a.height === b.height) {
    return a.width < b.width ? a : b;
  }
  return a.height > b.height ? a : b;
}

const TABLE_COMPONENT_SELECTORS: Record<
  TableComponent,
  <V>(a: Block<V>, b: Block<V>) => Block<V>
> = {
  head: bestHead,
  indexes: bestIndexes,
};

export function tryDeduplicateComponent<V>(
  tables: Table<V>[],
  component: TableComponent,
  proportionalResizeGuard: ProportionalResizeGuard
): Block<V> | null {
  const { [component]: cmp } = tables[0]!;
  if (!cmp) {
    return null;
  }
  const select = TABLE_COMPONENT_SELECTORS[component];
  const blocks = [cmp];
  let bestCmp = cmp;
  let lcmHeight = cmp.height;
  let lcmWidth = cmp.width;
  let maxHeight = cmp.height;
  let maxWidth = cmp.width;
  for (let i = 1; i < tables.length; i++) {
    const cmp = tables[i]![component];
    if (!cmp) {
      return null;
    }
    bestCmp = select(bestCmp, cmp);
    maxHeight = max(maxHeight, cmp.height);
    maxWidth = max(maxWidth, cmp.width);
    lcmHeight = lcm(lcmHeight, cmp.height);
    lcmWidth = lcm(lcmWidth, cmp.width);
    blocks.push(cmp);
  }
  const isHeightProportional = proportionalResizeGuard(lcmHeight, maxHeight);
  const isWidthProportional = proportionalResizeGuard(lcmWidth, maxWidth);
  if (
    !(component === "head" ? isHeightProportional : isWidthProportional) ||
    !areBlocksEqual({
      blocks,
      width: isWidthProportional ? lcmWidth : maxWidth,
      widthIsLcm: isWidthProportional,
      height: isHeightProportional ? lcmHeight : maxHeight,
      heightIsLcm: isHeightProportional,
    })
  ) {
    return null;
  }
  return bestCmp;
}

export function makeTableInPlaceBaker<V>({
  head: bakeHead,
  indexes: bakeIndexes,
  cornerCellValue,
}: BakeOptions<V>) {
  return ({ body, head, indexes }: Table<V>) => {
    if (!bakeHead && !bakeIndexes) {
      return body;
    }
    const useHead = bakeHead && head !== null;
    const useIndexes = bakeIndexes && indexes !== null;
    const withIndexes = useIndexes
      ? mergeBlocksHorizontally([indexes, body], body.height)
      : body;
    const width = body.width + (useIndexes ? indexes.width : 0);
    if (!useHead) {
      return withIndexes;
    }
    if (!useIndexes) {
      return mergeBlocksVertically([head, withIndexes], width);
    }
    // TODO: factor out `prependCell(Block, Cell)` ?
    for (let i = 0; i < head.data.rows.length; i++) {
      shiftPositionsInPlace(head.data.rows[i]!.columns, indexes.width);
    }
    const firstHeadRow = head.data.rows[0]!;
    firstHeadRow.cells.unshift({
      height: head.height,
      width: indexes.width,
      value: cornerCellValue,
      type: CellType.Corner,
    });
    firstHeadRow.columns.unshift(0);
    return mergeBlocksVertically([head, withIndexes], width);
  };
}

export function tryPrepareTablesToStack<V>(
  tables: Table<V>[],
  component: TableComponent,
  bake: boolean,
  cornerCellValue: V
) {
  const blocks: Block<V>[] = [];
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]!;
    const {
      [component]: cmp,
      [TABLE_COMPONENT_OPPOSITES[component]]: opposite,
    } = table;
    if (cmp === null) {
      return null;
    }
    if (!bake || !opposite) {
      blocks.push(cmp);
      continue;
    }
    switch (component) {
      case "indexes": {
        const shifted = cmp.data.indexes.slice();
        // mutation of local copy
        shiftPositionsInPlace(shifted, opposite.height);
        shifted.unshift(0);
        blocks.push({
          height: cmp.height + opposite.height,
          width: cmp.width,
          data: {
            rows: [
              {
                cells: [
                  {
                    height: opposite.height,
                    width: cmp.width,
                    value: cornerCellValue,
                    type: CellType.Corner,
                  },
                ],
                columns: [0],
              },
              ...cmp.data.rows,
            ],
            indexes: shifted,
          },
        });
        break;
      }
      case "head": {
        const shifted = cmp.data.rows[0]!.columns.slice();
        // mutation of local copy
        shiftPositionsInPlace(shifted, opposite.width);
        shifted.unshift(0);
        blocks.push({
          height: cmp.height,
          width: cmp.width + opposite.width,
          data: {
            rows: [
              {
                cells: [
                  {
                    height: cmp.height,
                    width: opposite.width,
                    value: cornerCellValue,
                    type: CellType.Corner,
                  },
                  ...cmp.data.rows[0]!.cells,
                ],
                columns: shifted,
              },
              ...cmp.data.rows.slice(1),
            ],
            indexes: cmp.data.indexes,
          },
        });
        break;
      }
      default:
        throw new Error(`Unknown table component: ${component}`);
    }
  }
  return blocks;
}

export interface TableStackerOptions<C extends TableComponent, V> {
  isProportionalResize: ProportionalResizeGuard;
  cornerCellValue: V;
  deduplicationComponent: C;
}

const TABLE_COMPONENT_TO_BLOCK_IN_PLACE_STACKERS: Record<
  TableComponent,
  <V>(guard: ProportionalResizeGuard) => BlockCompositor<V>
> = {
  head: makeVerticalBlockInPlaceStacker,
  indexes: makeHorizontalBlockInPlaceStacker,
};

export function makeTableInPlaceStacker<C extends TableComponent, V>({
  deduplicationComponent,
  isProportionalResize,
  cornerCellValue,
}: TableStackerOptions<C, V>): TableCompositor<V> {
  const blockInPlaceStacker =
    TABLE_COMPONENT_TO_BLOCK_IN_PLACE_STACKERS[deduplicationComponent]<V>(
      isProportionalResize
    );
  const opposite = TABLE_COMPONENT_OPPOSITES[deduplicationComponent];
  return (tables) => {
    const deduplicated = tryDeduplicateComponent(
      tables,
      deduplicationComponent,
      isProportionalResize
    );
    const bake = deduplicated === null;
    const blocksToStack = tryPrepareTablesToStack(
      tables,
      opposite,
      bake,
      cornerCellValue
    );
    const baked = tables.map(
      makeTableInPlaceBaker({
        [deduplicationComponent]: bake,
        [opposite]: blocksToStack === null,
        cornerCellValue,
      })
    );
    const body = blockInPlaceStacker(baked);
    const aspect = TABLE_COMPONENT_SIZE_ASPECTS[opposite];
    if (deduplicated) {
      const scale = makeBlockInPlaceScaler(aspect, body[aspect]);
      scale(deduplicated);
    }
    const composedTable: ComposedTable<V> = {
      body,
      baked,
      [deduplicationComponent as "head"]: deduplicated,
      [opposite as "indexes"]:
        blocksToStack && blockInPlaceStacker(blocksToStack),
    };
    return composedTable;
  };
}
