import {
  horizontalMirror,
  transpose,
  verticalMirror,
} from "@json-table/core/lib/matrix";
import type { JSONPrimitive } from "@json-table/core/lib/json";
import type { Block } from "@json-table/core";
import { createMatrix, fromMatrix } from "@json-table/core/block-matrix";
import { ASCIITableFormat } from "@json-table/core/block-to-ascii";
import type { TableFactoryOptions } from "@json-table/core/json-to-table";

export enum TransformPreset {
  Default = "Default",
  Manual = "Manual",
}

export enum OutputFormat {
  HTML = "HTML",
  XLSX = "XLSX",
  ASCII = "ASCII",
}
export type TransformConfig = {
  paginate: boolean;
} & (
  | {
      format: OutputFormat.ASCII;
      asciiFormat: ASCIITableFormat;
    }
  | {
      format: OutputFormat.HTML;
    }
  | {
      format: OutputFormat.XLSX;
    }
) &
  (
    | { preset: TransformPreset.Default }
    | ({
        preset: TransformPreset.Manual;
      } & TableFactoryOptions<JSONPrimitive>)
  ) &
  (
    | { transform: false }
    | {
        transform: true;
        horizontalReflect: boolean;
        verticalReflect: boolean;
        transpose: boolean;
      }
  );

export const APP_WORKER_ID = "app-worker";

export function extractTableFactoryOptions(
  config: TransformConfig
): TableFactoryOptions<JSONPrimitive> {
  switch (config.preset) {
    case TransformPreset.Default:
      return {
        cornerCellValue: "№",
        joinPrimitiveArrayValues: true,
        combineArraysOfObjects: false,
        proportionalSizeAdjustmentThreshold: 1,
        collapseIndexes: true,
        stabilizeOrderOfPropertiesInArraysOfObjects: true,
      };
    case TransformPreset.Manual: {
      const {
        collapseIndexes,
        joinPrimitiveArrayValues,
        combineArraysOfObjects,
        stabilizeOrderOfPropertiesInArraysOfObjects,
        proportionalSizeAdjustmentThreshold,
        cornerCellValue,
      } = config;
      return {
        collapseIndexes,
        joinPrimitiveArrayValues,
        combineArraysOfObjects,
        stabilizeOrderOfPropertiesInArraysOfObjects,
        proportionalSizeAdjustmentThreshold,
        cornerCellValue: cornerCellValue ?? "",
      };
    }
    default: {
      const n: never = config;
      throw new Error(`Unexpected preset "${JSON.stringify(n)}"`);
    }
  }
}

export function makeTransformApplicator(config: TransformConfig) {
  return (block: Block) => {
    if (!config.transform) {
      return block;
    }
    let matrix = createMatrix(block, ({ type, value }) => ({ type, value }));
    if (config.horizontalReflect) {
      matrix = horizontalMirror(matrix);
    }
    if (config.verticalReflect) {
      matrix = verticalMirror(matrix);
    }
    if (config.transpose) {
      matrix = transpose(matrix);
    }
    return fromMatrix(
      matrix,
      ({ type }) => type,
      ({ value }) => value
    );
  };
}
