import { UiSchema } from "@rjsf/utils";

import { JSONSchema } from "@/lib/json-schema";
import { TableFactoryOptions } from "@/lib/json-to-table";
import { JSONPrimitiveOrNull } from "@/lib/json";
import { Block } from "@/lib/json-table";
import { createMatrix, fromMatrix } from "@/lib/block-matrix";
import { horizontalMirror, transpose, verticalMirror } from "@/lib/matrix";
import { ASCIITableFormat, ASCII_TABLE_FORMATS } from "@/lib/block-to-ascii";
import { Request } from "@/lib/actor";

export enum TransformPreset {
  Default = "Default",
  Manual = "Manual",
}

export enum OutputFormat {
  HTML = "HTML",
  XLSX = "XLSX",
  ASCII = "ASCII",
}

export const TRANSFORM_SCHEMA: JSONSchema = {
  type: "object",
  title: "Options",
  properties: {
    preset: {
      title: "Preset",
      type: "string",
      enum: Object.values(TransformPreset),
      default: TransformPreset.Default,
    },
    transform: {
      title: "Transform",
      description: "Apply a transformation to the output data",
      type: "boolean",
      default: false,
    },
    format: {
      title: "Output format",
      type: "string",
      enum: Object.values(OutputFormat),
      default: OutputFormat.HTML,
    },
    paginate: {
      title: "Paginate",
      description:
        "Partitioning the input data (object or array) into pages by their keys",
      type: "boolean",
      default: false,
    },
    createOnOpen: {
      type: "boolean",
      title: "Create on open",
      description: "Creating a table when opening a share link",
      default: true,
    },
  },
  required: ["preset", "format"],
  dependencies: {
    preset: {
      oneOf: [
        {
          properties: {
            preset: {
              const: TransformPreset.Default,
            },
          },
        },
        {
          properties: {
            preset: {
              const: TransformPreset.Manual,
            },
            collapseIndexes: {
              title: "Combine nested indexes",
              description:
                "Combines hierarchical indexes into one cell (1.1, 1.2, ...)",
              type: "boolean",
              default: true,
            },
            joinPrimitiveArrayValues: {
              title: "Combine simple values",
              description:
                "Combines the values of an array of primitives into one cell (separated by ',')",
              type: "boolean",
              default: true,
            },
            combineArraysOfObjects: {
              title: "Combine objects",
              description: "Combine arrays of objects into a single object",
              type: "boolean",
              default: false,
            },
            stabilizeOrderOfPropertiesInArraysOfObjects: {
              title: "Stabilize order of properties",
              description:
                "Stabilizing the order in which properties are displayed for arrays of objects",
              type: "boolean",
              default: true,
            },
            proportionalSizeAdjustmentThreshold: {
              title: "Proportional size adjustment threshold",
              description:
                "Specifies the threshold to which the value (height, width) can be increased for a proportional increase. The default is 1 (by 100%).",
              type: "number",
              minimum: 0,
              default: 1,
            },
            cornerCellValue: {
              title: "Corner cell value",
              description: "The value of the corner cell.",
              type: "string",
              default: "№",
            },
          },
          required: ["proportionalSizeAdjustmentThreshold"],
        },
      ],
    },
    transform: {
      oneOf: [
        {
          properties: {
            transform: {
              const: false,
            },
          },
        },
        {
          properties: {
            transform: {
              const: true,
            },
            horizontalReflect: {
              type: "boolean",
              title: "Reflect horizontally",
              default: false,
            },
            verticalReflect: {
              type: "boolean",
              title: "Reflect vertically",
              default: false,
            },
            transpose: {
              type: "boolean",
              title: "Transpose",
              default: false,
            },
          },
        },
      ],
    },
    format: {
      oneOf: [
        {
          properties: {
            format: {
              const: OutputFormat.HTML,
            },
          },
        },
        {
          properties: {
            format: {
              const: OutputFormat.XLSX,
            },
          },
        },
        {
          properties: {
            format: {
              const: OutputFormat.ASCII,
            },
            asciiFormat: {
              type: "string",
              title: "ASCII table format",
              enum: ASCII_TABLE_FORMATS,
              default: ASCIITableFormat.MySQL,
            },
          },
        },
      ],
    },
  },
};

export const TRANSFORMED_UI_SCHEMA: UiSchema = {
  "ui:order": [
    "preset",
    "collapseIndexes",
    "joinPrimitiveArrayValues",
    "combineArraysOfObjects",
    "stabilizeOrderOfPropertiesInArraysOfObjects",
    "proportionalSizeAdjustmentThreshold",
    "cornerCellValue",
    "transform",
    "horizontalReflect",
    "verticalReflect",
    "transpose",
    "format",
    "asciiFormat",
    "paginate",
    "createOnOpen",
  ],
};

export type TransformConfig = {
  paginate: boolean;
  createOnOpen: boolean;
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
      } & TableFactoryOptions<JSONPrimitiveOrNull>)
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

export function extractTableFactoryOptions(
  config: TransformConfig
): TableFactoryOptions<JSONPrimitiveOrNull> {
  switch (config.preset) {
    case TransformPreset.Default:
      return {
        collapseIndexes: true,
        joinPrimitiveArrayValues: true,
        combineArraysOfObjects: false,
        proportionalSizeAdjustmentThreshold: 1,
        stabilizeOrderOfPropertiesInArraysOfObjects: true,
        cornerCellValue: "№",
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

export const APP_WORKER_ID = "app-worker";

export enum WorkerActionType {
  Hello = "hello",
  CreateTable = "create-table",
}

export interface AbstractWorkerAction<T extends WorkerActionType>
  extends Request<T> {}

export interface HelloWorkerAction
  extends AbstractWorkerAction<WorkerActionType.Hello> {
  message: string;
}

export interface CreateTableWorkerAction
  extends AbstractWorkerAction<WorkerActionType.CreateTable> {
  data: string;
  transformConfig: TransformConfig;
}

export type WorkerAction = HelloWorkerAction | CreateTableWorkerAction;

export interface WorkerActionResult {
  [WorkerActionType.Hello]: string;
  [WorkerActionType.CreateTable]: string;
}
