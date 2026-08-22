import { type JSONPrimitive } from "@json-table/core/lib/json";
import {
  ASCIITableFormat,
  type Tree,
  type TreeFactoryOptions,
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
      } & TreeFactoryOptions<JSONPrimitive>)
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
        joinPrimitiveArrayValues: true,
        proportionalSizeAdjustmentThreshold: 1,
        collapseIndexes: true,
        stabilizeOrderOfPropertiesInArraysOfObjects: true,
      };
    case TransformPreset.Manual: {
      const {
        collapseIndexes,
        joinPrimitiveArrayValues,
        stabilizeOrderOfPropertiesInArraysOfObjects,
        proportionalSizeAdjustmentThreshold,
        cornerCellValue,
      } = config;
      return {
        collapseIndexes,
        joinPrimitiveArrayValues,
        stabilizeOrderOfPropertiesInArraysOfObjects,
        proportionalSizeAdjustmentThreshold,
        cornerCellValue: cornerCellValue ?? "",
        createHeader: TREE_FACTORY_HEADER,
        createIndex: TREE_FACTORY_INDEX,
      };
    }
    default: {
      const n: never = config;
      throw new Error(`Unexpected preset "${JSON.stringify(n)}"`);
    }
  }
}

/** reverses the order of children along the row axis */
function horizontalMirrorInPlace<V>(tree: Tree<V>): void {
  if (!("children" in tree)) {
    return;
  }
  for (const child of tree.children) {
    horizontalMirrorInPlace(child);
  }
  if (tree.type === "row") {
    tree.children.reverse();
  }
}

/** reverses the order of children along the col axis */
function verticalMirrorInPlace<V>(tree: Tree<V>): void {
  if (!("children" in tree)) {
    return;
  }
  for (const child of tree.children) {
    verticalMirrorInPlace(child);
  }
  if (tree.type === "col") {
    tree.children.reverse();
  }
}

function transposeTree<V>(tree: Tree<V>): Tree<V> {
  if (!("children" in tree)) {
    return tree;
  }
  return {
    ...tree,
    type: tree.type === "row" ? "col" : "row",
    width: tree.height,
    height: tree.width,
    children: tree.children.map(transposeTree),
  };
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
