import {
  type JSONPrimitiveOrNull,
  type JSONRecord,
  type JSONValue,
  isJsonPrimitiveOrNull,
} from "./lib/json.js";
import {
  type Table,
  type Cells,
  makeTableFromValue,
  makeProportionalResizeGuard,
  type ComposedTable,
  CellType,
  shiftPositionsInPlace,
  makeTableInPlaceStacker,
  mergeBlocksHorizontally,
  type Block,
} from "./model/index.js";
import { isRecord } from "./lib/guards.js";
import { array } from "./lib/array.js";
import { makeObjectPropertiesStabilizer } from "./lib/object.js";

export interface TableFactoryOptions<V> {
  joinPrimitiveArrayValues?: boolean;
  /** combine arrays of objects into a single object */
  combineArraysOfObjects?: boolean;
  /** proportional size adjustment threshold */
  proportionalSizeAdjustmentThreshold?: number;
  collapseIndexes?: boolean;
  cornerCellValue: V;
  stabilizeOrderOfPropertiesInArraysOfObjects?: boolean;
}

export function makeTableFactory({
  combineArraysOfObjects,
  joinPrimitiveArrayValues,
  proportionalSizeAdjustmentThreshold = 1,
  stabilizeOrderOfPropertiesInArraysOfObjects = true,
  cornerCellValue,
  collapseIndexes,
}: TableFactoryOptions<JSONPrimitiveOrNull>) {
  const isProportionalResize = makeProportionalResizeGuard(
    proportionalSizeAdjustmentThreshold
  );
  const verticalTableInPlaceStacker = makeTableInPlaceStacker({
    deduplicationComponent: "head",
    isProportionalResize,
    cornerCellValue,
  });
  const horizontalTableInPlaceStacker = makeTableInPlaceStacker({
    deduplicationComponent: "indexes",
    isProportionalResize,
    cornerCellValue,
  });

  function addIndexesInPlace(table: ComposedTable, titles: string[]): void {
    const { baked, indexes: indexesBlock } = table;
    const hasIndexes = indexesBlock !== null;
    const collapse = hasIndexes && collapseIndexes;
    if (collapse) {
      let blockIndex = 0;
      let h = baked[0]!.height;
      const { rows, indexes } = indexesBlock.data;
      for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i]!;
        const index = indexes[i]!;
        if (index >= h) {
          h += baked[++blockIndex]!.height;
        }
        const title = titles[blockIndex];
        rawRow.cells[0]!.value = `${title}.${rawRow.cells[0]!.value}`;
      }
      return;
    }
    const rawRows = array<Cells>(baked.length, () => ({
      cells: [],
      columns: [],
    }));
    const idx = new Array<number>(0);
    let index = 0;
    for (let i = 0; i < baked.length; i++) {
      const rawRow = rawRows[i]!;
      const { height } = baked[i]!;
      rawRow.cells.push({
        height: height,
        width: 1,
        value: titles[i]!,
        type: CellType.Index,
      });
      rawRow.columns.push(0);
      idx.push(index);
      index += height;
    }
    const newIndexes: Block = {
      height: index,
      width: 1,
      data: {
        rows: rawRows,
        indexes: idx,
      },
    };
    table.indexes = hasIndexes
      ? mergeBlocksHorizontally([newIndexes, indexesBlock], index)
      : newIndexes;
  }

  function addHeaders(table: ComposedTable, titles: string[]): void {
    const { baked, head } = table;
    const hasHeaders = head !== null;
    const newHead: Cells = {
      cells: [],
      columns: [],
    };
    let w = 0;
    for (let i = 0; i < baked.length; i++) {
      const { width } = baked[i]!;
      newHead.cells.push({
        height: 1,
        width,
        value: titles[i]!,
        type: CellType.Header,
      });
      newHead.columns.push(w);
      w += width;
    }
    if (hasHeaders) {
      head.data.rows.unshift(newHead);
      shiftPositionsInPlace(head.data.indexes, 1);
      head.data.indexes.unshift(0);
    }
    table.head = {
      width: w,
      height: hasHeaders ? head.height + 1 : 1,
      data: hasHeaders ? head.data : { rows: [newHead], indexes: [0] },
    };
  }

  function stackTablesVertical(titles: string[], tables: Table[]): Table {
    const stacked = verticalTableInPlaceStacker(tables);
    addIndexesInPlace(stacked, titles);
    // @ts-expect-error transform to regular table
    delete stacked.baked;
    return stacked;
  }
  function stackTablesHorizontal(titles: string[], tables: Table[]): Table {
    const stacked = horizontalTableInPlaceStacker(tables);
    addHeaders(stacked, titles);
    // @ts-expect-error transform to regular table
    delete stacked.baked;
    return stacked;
  }
  function transformRecord(record: Record<string, JSONValue>): Table {
    const keys = Object.keys(record);
    if (keys.length === 0) {
      return makeTableFromValue("");
    }
    return stackTablesHorizontal(
      keys,
      keys.map((key) => transformValue(record[key]!))
    );
  }
  function transformArray<V extends JSONValue>(
    value: V[],
    transformValue: (value: V) => Table
  ): Table {
    const titles = new Array<string>(value.length);
    const tables = new Array<Table>(value.length);
    for (let i = 0; i < value.length; i++) {
      titles[i] = String(i + 1);
      tables[i] = transformValue(value[i]!);
    }
    return stackTablesVertical(titles, tables);
  }
  function transformValue(value: JSONValue): Table {
    if (isJsonPrimitiveOrNull(value)) {
      return makeTableFromValue(value);
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return makeTableFromValue("");
      }
      let isPrimitives = true;
      let isRecords = true;
      let i = 0;
      while (i < value.length && (isPrimitives || isRecord)) {
        isPrimitives = isPrimitives && isJsonPrimitiveOrNull(value[i]!);
        isRecords = isRecords && isRecord(value[i]);
        i++;
      }
      if (joinPrimitiveArrayValues && isPrimitives) {
        return makeTableFromValue(value.join(", "));
      }
      if (combineArraysOfObjects && isRecords) {
        return transformRecord(Object.assign({}, ...value));
      }
      if (stabilizeOrderOfPropertiesInArraysOfObjects && isRecords) {
        const stabilize = makeObjectPropertiesStabilizer<JSONValue>();
        return transformArray(value as JSONRecord[], (value) => {
          const [keys, values] = stabilize(value);
          if (keys.length === 0) {
            return makeTableFromValue("");
          }
          return stackTablesHorizontal(keys, values.map(transformValue));
        });
      }
      return transformArray(value, transformValue);
    }
    return transformRecord(value);
  }
  return transformValue;
}
