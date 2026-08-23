import { describe, expect, it } from "vitest";

import type { JSONValue } from "./lib/json";
import { ASCIITableFormat, toASCII } from "./tree-to-ascii";
import { toHTML } from "./tree-to-html";
import {
  horizontalMirrorInPlace,
  transposeTree,
  verticalMirrorInPlace,
} from "./model";
import { makeTreeFactory } from "./json-to-tree";

import collapsedIndexes from "./__fixtures__/collapsed-indexes.json";
import company from "./__fixtures__/company.json";
import deduplication from "./__fixtures__/deduplication.json";
import emptyArrays from "./__fixtures__/empty-arrays.json";
import formatInBothItems from "./__fixtures__/format-in-both-items.json";
import fullyDeduplicated from "./__fixtures__/fully-deduplicated.json";
import indexesDeduplication from "./__fixtures__/indexes-deduplication.json";
import joinPrimitiveValues from "./__fixtures__/parsing-error.json";
import multilineHeaders from "./__fixtures__/multiline-headers.json";
import nestedArrays from "./__fixtures__/nested-arrays.json";
import noHeaderDedup from "./__fixtures__/no-header-dedup.json";
import objects from "./__fixtures__/objects.json";
import partiallyDifferentHeaders from "./__fixtures__/partially-different-headers.json";
import shuffledKeys from "./__fixtures__/shuffled-keys.json";
import simpleHeadersDuplication from "./__fixtures__/simple-headers-duplication.json";
import uniqHeaders from "./__fixtures__/uniq-headers.json";
import wrongSizes from "./__fixtures__/wrong-sizes.json";

interface RenderFixture {
  name: string;
  options: Record<string, unknown>;
  input: JSONValue;
}

const renderFixtures = [
  collapsedIndexes,
  company,
  deduplication,
  emptyArrays,
  formatInBothItems,
  fullyDeduplicated,
  indexesDeduplication,
  joinPrimitiveValues,
  multilineHeaders,
  nestedArrays,
  noHeaderDedup,
  objects,
  partiallyDifferentHeaders,
  shuffledKeys,
  simpleHeadersDuplication,
  uniqHeaders,
  wrongSizes,
] as unknown as RenderFixture[];

describe.each(renderFixtures)("$name", ({ name, options, input }) => {
  const createTree = makeTreeFactory<JSONValue>({
    cornerCellValue: "#",
    createHeader: (k: string) => k,
    createIndex: (i: number) => `${i + 1}`,
    ...options,
  } as never);
  const tree = createTree(input);

  it("renders expected ascii table", () => {
    expect(`\n${toASCII(tree)}`).toMatchSnapshot(`${name} ascii`);
  });

  it("renders expected markdown-like ascii table", () => {
    expect(
      `\n${toASCII(tree, { format: ASCIITableFormat.MarkdownLike })}`,
    ).toMatchSnapshot(`${name} markdown-like`);
  });

  it("renders expected html table", () => {
    expect(toHTML(tree)).toMatchSnapshot(`${name} html`);
  });
});

describe("'company structure' transformations", () => {
  const createTree = makeTreeFactory<JSONValue>({
    cornerCellValue: "#",
    createHeader: (k: string) => k,
    createIndex: (i: number) => `${i + 1}`,
    collapseIndexes: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyInput = (company as any).input as JSONValue;

  it("renders expected horizontally mirrored table", () => {
    const tree = createTree(companyInput);
    horizontalMirrorInPlace(tree);
    expect(`\n${toASCII(tree)}`).toMatchSnapshot("company hmirror ascii");
  });

  it("renders expected vertically mirrored table", () => {
    const tree = createTree(companyInput);
    verticalMirrorInPlace(tree);
    expect(`\n${toASCII(tree)}`).toMatchSnapshot("company vmirror ascii");
  });

  it("renders expected transposed table", () => {
    const tree = transposeTree(createTree(companyInput));
    expect(`\n${toASCII(tree)}`).toMatchSnapshot("company transpose ascii");
    expect(() => toHTML(tree)).not.toThrow();
  });
});
