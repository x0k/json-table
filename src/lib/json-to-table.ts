import {
  JSONPrimitiveOrNull,
  JSONRecord,
  JSONValue,
  isJsonPrimitiveOrNull,
} from "@/lib/json";
import {
  Table,
  Cells,
  makeTableFromValue,
  makeProportionalResizeGuard,
  ComposedTable,
  CellType,
  shiftNumbers,
  makeTableStacker,
} from "@/lib/json-table";
import { isRecord } from "@/lib/guards";
import { array } from "@/lib/array";
import { makeObjectPropertiesStabilizer } from "@/lib/object";

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

const EMPTY = makeTableFromValue("");

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
  const verticalTableStacker = makeTableStacker({
    deduplicationComponent: "head",
    isProportionalResize,
    cornerCellValue,
  });
  const horizontalTableStacker = makeTableStacker({
    deduplicationComponent: "indexes",
    isProportionalResize,
    cornerCellValue,
  });

  function addIndexes(
    { baked, body, head, indexes }: ComposedTable,
    titles: string[]
  ): Table {
    const hasIndexes = indexes !== null;
    const collapse = hasIndexes && collapseIndexes;
    const indexesRows = hasIndexes
      ? indexes.data.slice()
      : array(body.height, () => ({
          cells: [],
          columns: [],
        }));
    let h = 0;
    for (let i = 0; i < baked.length; i++) {
      const height = baked[i].height;
      if (collapse) {
        let y = 0;
        while (y < height) {
          const hy = h + y;
          const cells = indexesRows[hy].cells;
          indexesRows[hy] = {
            cells: [
              {
                ...cells[0],
                value: `${titles[i]}.${cells[0].value}`,
              },
              ...cells.slice(1),
            ],
            columns: indexesRows[hy].columns,
          };
          y += cells[0].height;
        }
      } else {
        indexesRows[h] = {
          cells: [
            {
              height,
              width: 1,
              value: titles[i],
              type: CellType.Index,
            },
            ...indexesRows[h].cells,
          ],
          columns: [0, ...shiftNumbers(indexesRows[h].columns, 1)],
        };
        if (hasIndexes) {
          for (let j = 1; j < height; j++) {
            const hj = h + j;
            indexesRows[hj] = {
              cells: indexesRows[hj].cells,
              columns: shiftNumbers(indexesRows[hj].columns, 1),
            };
          }
        }
      }
      h += height;
    }
    return {
      head,
      body,
      indexes: {
        data: indexesRows,
        width: hasIndexes ? indexes.width + Number(!collapseIndexes) : 1,
        height: h,
      },
    };
  }

  function addHeaders(
    { baked, body, head, indexes }: ComposedTable,
    titles: string[]
  ): Table {
    const hasHeaders = head !== null;
    const newHead: Cells = {
      cells: [],
      columns: [],
    };
    let w = 0;
    for (let i = 0; i < baked.length; i++) {
      const { width } = baked[i];
      newHead.cells.push({
        height: 1,
        width,
        value: titles[i],
        type: CellType.Header,
      });
      newHead.columns.push(w);
      w += width;
    }
    return {
      head: {
        data: hasHeaders ? [newHead, ...head.data] : [newHead],
        width: w,
        height: hasHeaders ? head.height + 1 : 1,
      },
      body,
      indexes,
    };
  }

  function stackTablesVertical(titles: string[], tables: Table[]): Table {
    const stacked = verticalTableStacker(tables);
    return addIndexes(stacked, titles);
  }
  function stackTablesHorizontal(titles: string[], tables: Table[]): Table {
    const stacked = horizontalTableStacker(tables);
    return addHeaders(stacked, titles);
  }
  function transformRecord(record: Record<string, JSONValue>): Table {
    const keys = Object.keys(record);
    if (keys.length === 0) {
      return EMPTY;
    }
    return stackTablesHorizontal(
      keys,
      keys.map((key) => transformValue(record[key]))
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
      tables[i] = transformValue(value[i]);
    }
    return stackTablesVertical(titles, tables);
  }
  function transformValue(value: JSONValue): Table {
    if (isJsonPrimitiveOrNull(value)) {
      return makeTableFromValue(value);
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return EMPTY;
      }
      let isPrimitives = true;
      let isRecords = true;
      let i = 0;
      while (i < value.length && (isPrimitives || isRecord)) {
        isPrimitives = isPrimitives && isJsonPrimitiveOrNull(value[i]);
        isRecords = isRecords && isRecord(value[i]);
        i++;
      }
      if (joinPrimitiveArrayValues && isPrimitives) {
        return makeTableFromValue(value.join(", "));
      }
      if (combineArraysOfObjects && isRecords) {
        return transformRecord(Object.assign({}, ...value));
      }
      if (
        stabilizeOrderOfPropertiesInArraysOfObjects &&
        isRecords
      ) {
        const stabilize = makeObjectPropertiesStabilizer();
        return transformArray(value as JSONRecord[], (value) => {
          const [keys, values] = stabilize(value);
          return stackTablesHorizontal(keys, values.map(transformValue));
        });
      }
      return transformArray(value, transformValue);
    }
    return transformRecord(value);
  }
  return transformValue;
}
