import { type JSONPrimitive } from "@json-table/core/lib/json";
import {
  ASCIITableFormat,
  joinPrimitiveArrayValues,
  makeProportionalResizeGuard,
  type Tree,
  type TreeFactoryOptions,
  horizontalMirrorInPlace,
  transposeTree,
  verticalMirrorInPlace,
} from "@json-table/core";

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
        joinPrimitiveArrayValues?: boolean;
        proportionalSizeAdjustmentThreshold?: number;
      } & Omit<
        TreeFactoryOptions<JSONPrimitive>,
        "joinPrimitiveArrayValues" | "isProportionalResize"
      >)
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

const TREE_FACTORY_HEADER = (key: string) => key;
const TREE_FACTORY_INDEX = (i: number) => `${i + 1}`;

export function extractTableFactoryOptions(
  config: TransformConfig
): TreeFactoryOptions<JSONPrimitive> {
  switch (config.preset) {
    case TransformPreset.Default:
      return {
        cornerCellValue: "№",
        createHeader: TREE_FACTORY_HEADER,
        createIndex: TREE_FACTORY_INDEX,
        joinArrayValues: joinPrimitiveArrayValues,
        isProportionalResize: makeProportionalResizeGuard(1),
        collapseIndexes: true,
        stabilizeOrderOfPropertiesInArraysOfObjects: true,
        deduplicateHeaders: true,
      };
    case TransformPreset.Manual: {
      const {
        collapseIndexes,
        joinPrimitiveArrayValues: joinToggle,
        stabilizeOrderOfPropertiesInArraysOfObjects,
        proportionalSizeAdjustmentThreshold: threshold,
        cornerCellValue,
        deduplicateHeaders,
        createLeaf,
        emptyCellValue,
        isHeaderEqual,
      } = config;
      return {
        collapseIndexes,
        joinArrayValues: joinToggle ? joinPrimitiveArrayValues : undefined,
        stabilizeOrderOfPropertiesInArraysOfObjects,
        isProportionalResize: makeProportionalResizeGuard(threshold ?? 1),
        cornerCellValue: cornerCellValue ?? "",
        deduplicateHeaders,
        createHeader: TREE_FACTORY_HEADER,
        createIndex: TREE_FACTORY_INDEX,
        createLeaf,
        emptyCellValue,
        isHeaderEqual,
      };
    }
    default: {
      const n: never = config;
      throw new Error(`Unexpected preset "${JSON.stringify(n)}"`);
    }
  }
}

export function makeTransformApplicator(config: TransformConfig) {
  return (tree: Tree<JSONPrimitive>): Tree<JSONPrimitive> => {
    if (!config.transform) {
      return tree;
    }
    if (config.horizontalReflect) {
      horizontalMirrorInPlace(tree);
    }
    if (config.verticalReflect) {
      verticalMirrorInPlace(tree);
    }
    if (config.transpose) {
      return transposeTree(tree);
    }
    return tree;
  };
}
