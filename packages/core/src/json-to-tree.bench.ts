import { bench, describe } from "vitest";

import type { JSONValue } from "./lib/json.js";
import {
  joinPrimitiveArrayValues,
  makeTreeFactory,
} from "./json-to-tree.js";

import company from "./__fixtures__/company.js";
import departmentsProjects from "./__fixtures__/departments-projects.js";
import nestedArrays from "./__fixtures__/nested-arrays.js";

const baseOptions = {
  cornerCellValue: "#",
  createHeader: (k: string) => k,
  createIndex: (i: number) => `${i + 1}`,
} as const;

function makeObjects(rows: number, keys: number): JSONValue[] {
  const out: JSONValue[] = new Array(rows);
  for (let i = 0; i < rows; i++) {
    const record: Record<string, JSONValue> = {};
    for (let k = 0; k < keys; k++) {
      record[`key${k}`] = `value-${i}-${k}`;
    }
    out[i] = record;
  }
  return out;
}

function makeDeep(depth: number): JSONValue {
  let value: JSONValue = "leaf";
  for (let i = 0; i < depth; i++) {
    value = { [`level${i}`]: value };
  }
  return value;
}

const largeTable = makeObjects(5000, 10);
const wideRecord: JSONValue = Object.fromEntries(
  Array.from({ length: 50 }, (_, k) => [`key${k}`, `value-${k}`]),
);
const deepTree = makeDeep(8);

describe("makeTreeFactory", () => {
  const createTree = makeTreeFactory<JSONValue>({ ...baseOptions });

  bench("company fixture", () => {
    createTree(company.input as JSONValue);
  });
  bench("departments-projects fixture", () => {
    createTree(departmentsProjects.input as JSONValue);
  });
  bench("nested-arrays fixture", () => {
    createTree(nestedArrays.input as JSONValue);
  });
  bench("5000x10 array of objects (lifting pipeline)", () => {
    createTree(largeTable);
  });
  bench("50-key-wide record", () => {
    createTree(wideRecord);
  });
  bench("8-deep nesting", () => {
    createTree(deepTree);
  });
});

describe("makeTreeFactory with collapseIndexes", () => {
  const createTree = makeTreeFactory<JSONValue>({
    ...baseOptions,
    collapseIndexes: true,
  });

  bench("5000x10 array of objects", () => {
    createTree(largeTable);
  });
  bench("nested-arrays fixture", () => {
    createTree(nestedArrays.input as JSONValue);
  });
});

describe("makeTreeFactory with joinPrimitiveArrayValues", () => {
  const createTree = makeTreeFactory<JSONValue>({
    ...baseOptions,
    joinArrayValues: joinPrimitiveArrayValues,
  });

  bench("5000x10 array of objects", () => {
    createTree(largeTable);
  });
});
