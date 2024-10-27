import { describe, expect, it } from "vitest";

import { blockToASCII } from "../block-to-ascii/index.js";
import type { JSONPrimitive } from "../lib/json.js";

import { makeTableFactory } from "./json-to-table.js";
import { makeTableInPlaceBaker } from "./table";

import simpleHeadersDuplication from "./__fixtures__/simple-headers-duplication.json";
import simpleIndexesDeduplication from "./__fixtures__/simple-indexes-deduplication.json";
import parsingError from "./__fixtures__/parsing-error.json";
import differentHeaders from "./__fixtures__/different-headers.json";
import uniqueHeaders from "./__fixtures__/uniq-headers.json";
import wrongSizes from "./__fixtures__/wrong-sizes.json";
import emptyArrays from "./__fixtures__/empty-arrays.json";

describe("makeTableFactory", () => {
  const cornerCellValue = "№";
  const factory = makeTableFactory({ cornerCellValue });
  const bake = makeTableInPlaceBaker<JSONPrimitive>({
    cornerCellValue,
    head: true,
    indexes: true,
  });

  it("Should create table for primitives", () => {
    const data = [false, 12345, "abcde"];
    for (const value of data) {
      const table = factory(value);
      const ascii = blockToASCII(bake(table));
      expect(`\n${ascii}`).toBe(`
+-------+
| ${value} |
+-------+`);
    }
  });

  it("Should create table for objects", () => {
    const data = {
      a: 1,
      b: 2,
      c: { aa: 11, bb: 22 },
    };
    const table = factory(data);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+---+---+---------+
| a | b |    c    |
+---+---+----+----+
|   |   | aa | bb |
| 1 | 2 +----+----+
|   |   | 11 | 22 |
+---+---+----+----+
`);
  });

  it("Should create table for arrays", () => {
    const data = [1, 2, [11, 22]];
    const table = factory(data);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+---+--------+
| 1 |      1 |
+---+--------+
| 2 |      2 |
+---+---+----+
|   | 1 | 11 |
| 3 +---+----+
|   | 2 | 22 |
+---+---+----+
`);
  });

  it("Should create table for arrays with indexes collapse", () => {
    const factory = makeTableFactory({
      cornerCellValue,
      collapseIndexes: true,
    });
    const data = [
      [1, 2],
      [11, 22],
    ];
    const table = factory(data);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+-----+----+
| 1.1 |  1 |
+-----+----+
| 1.2 |  2 |
+-----+----+
| 2.1 | 11 |
+-----+----+
| 2.2 | 22 |
+-----+----+
`);
  });

  it("Should deduplicate table headers", () => {
    const table = factory(simpleHeadersDuplication);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+---+---+---+---+
| № | a | b | c |
+---+---+---+---+
| 1 | 1 | 2 | 3 |
+---+---+---+---+
| 2 | 4 | 5 | 6 |
+---+---+---+---+
| 3 | 7 | 8 | 9 |
+---+---+---+---+
`);
  });

  it("Should deduplicate table indexes", () => {
    const table = factory(simpleIndexesDeduplication);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+---+---+---+---+
| № | a | b | c |
+---+---+---+---+
| 1 | 1 | 2 | 3 |
+---+---+---+---+
| 2 | 4 | 5 | 6 |
+---+---+---+---+
| 3 | 7 | 8 | 9 |
+---+---+---+---+
`);
  });

  it("Should combine simple values should not affect objects values", () => {
    const factory = makeTableFactory({
      cornerCellValue,
      joinPrimitiveArrayValues: true,
    });
    const table = factory(parsingError);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+---+-----------------------------------+
|   |              weather              |
| № +------+-------+-------------+------+
|   |  id  | main  | description | icon |
+---+------+-------+-------------+------+
| 1 |  800 | Clear | clear sky   | 01n  |
+---+------+-------+-------------+------+
`);
  });

  it("Should not deduplicate objects with different headers", () => {
    const table = factory(differentHeaders as any);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+---+------------------------------+---------------------+
|   |         character_id         |       item_id       |
| 1 +------------------------------+---------------------+
|   |          5428010618020694593 |                  95 |
+---+---------------------+--------+-------+-------------+
|   |    character_id     |    item_id     | stack_count |
| 2 +---------------------+----------------+-------------+
|   | 5428010618020694593 |            101 |           4 |
+---+---------------------+----------------+-------------+
`);
  });

  it("Should work with unique headers", () => {
    const table = factory(uniqueHeaders as any);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+---+-----------------------------+------+------+----------+--------+-------------+
|   |         description         |  in  | name | required |  type  | uniqueItems |
| 1 +-----------------------------+------+------+----------+--------+-------------+
|   | name of the ComponentStatus | path | name | true     | string | true        |
+---+-----------------------------+------+------+----------+--------+-------------+
|   |                                    $ref                                     |
| 2 +-----------------------------------------------------------------------------+
|   | #/parameters/pretty-tJGM1-ng                                                |
+---+-----------------------------------------------------------------------------+
`);
  });

  it("Should create correct table", () => {
    const table = factory(wrongSizes as any);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+---+---------------+---------------+-----------------------------------------+
| № |    options    | pluginVersion |                 targets                 |
+---+---------------+---------------+-------+------------------------+--------+
|   | reduceOptions |               |       |                        |        |
|   |               |               |   №   |          expr          | format |
|   +---------------+               |       |                        |        |
|   |               |               |       |                        |        |
| 1 |    values     | 7.3.1         +-------+------------------------+--------+
|   |               |               |       |                        |        |
|   +---------------+               |   1   | loki_build_info        | table  |
|   | false         |               |       |                        |        |
|   |               |               |       |                        |        |
+---+---------------+---------------+-------+------------------------+--------+
|   | reduceOptions |               |       |                                 |
|   |               |               |   №   |              expr               |
|   +---------------+               |       |                                 |
|   |               |               |       |                                 |
| 2 |    values     | 7.3.1         +-------+---------------------------------+
|   |               |               |       |                                 |
|   +---------------+               |   1   | sum(log_messages_total)         |
|   | false         |               |       |                                 |
|   |               |               |       |                                 |
+---+---------------+---------------+-------+---------------------------------+
`);
  });

  it("Should deduplicate equal headers with different sizes", () => {
    const data = [
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 2, c: { d: 4, e: 5 } },
    ];
    const table = factory(data);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+---+---+---+-------+
| № | a | b |   c   |
+---+---+---+-------+
| 1 | 1 | 2 |     3 |
+---+---+---+---+---+
|   |   |   | d | e |
| 2 | 1 | 2 +---+---+
|   |   |   | 4 | 5 |
+---+---+---+---+---+
`);
  });
  // The original problem was in the modification of global `EMPTY` table
  it("Should handle empty arrays", () => {
    const table = factory(emptyArrays as any);
    const ascii = blockToASCII(bake(table));
    expect(`\n${ascii}\n`).toBe(`
+---+------------------------------------------------------------------------------+
|   |                                    tasks                                     |
| № +---------------------------+---+----------------------------------------------+
|   |             n             | d |                      a                       |
+---+---+-----------------------+---+----------------------+-----------------------+
| 1 | 1 | UspYpi-8NwmZZR7FJprSb |   |          1           | aCx8zMrOjqW6K55TMokHD |
+---+---+-----------------------+---+----------------------+-----------------------+
| 2 |   |                       | 1 | gwT5xfbxgkPCq_VDyoBO3                        |
+---+---+-----------------------+---+----------------------------------------------+
`);
  });

  it("Should respect enforceDeduplication option", () => {
    const data = [
      {
        a: 1,
        b: {
          c: 1,
        },
      },
      {
        a: 2,
        b: {
          c: 2,
        },
      },
    ];
    const factory = makeTableFactory({
      cornerCellValue,
      enforceDeduplication: true,
    });
    const table = factory(data);
    const ascii = blockToASCII(bake(table));
    console.log(ascii);
    expect(`\n${ascii}\n`).toBe(`
+---+---+---+
|   |   | b |
| № | a +---+
|   |   | c |
+---+---+---+
| 1 | 1 | 1 |
+---+---+---+
| 2 | 2 | 2 |
+---+---+---+
`);
  });
});
