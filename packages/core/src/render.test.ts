import { describe, expect, it } from "vitest";

import type { JSONValue } from "./lib/json";
import { ASCIITableFormat, toASCII } from "./tree-to-ascii";
import { toHTML } from "./tree-to-html";
import { makeTreeFactory } from "./tree/json-to-tree";

import collapsedIndexes from "./tree/__fixtures__/collapsed-indexes.json";
import deduplication from "./tree/__fixtures__/deduplication.json";
import emptyArrays from "./tree/__fixtures__/empty-arrays.json";
import formatInBothItems from "./tree/__fixtures__/format-in-both-items.json";
import fullyDeduplicated from "./tree/__fixtures__/fully-deduplicated.json";
import indexesDeduplication from "./tree/__fixtures__/indexes-deduplication.json";
import multilineHeaders from "./tree/__fixtures__/multiline-headers.json";
import nestedArrays from "./tree/__fixtures__/nested-arrays.json";
import noHeaderDedup from "./tree/__fixtures__/no-header-dedup.json";
import objects from "./tree/__fixtures__/objects.json";
import partiallyDifferentHeaders from "./tree/__fixtures__/partially-different-headers.json";
import simpleHeadersDuplication from "./tree/__fixtures__/simple-headers-duplication.json";
import shuffledKeys from "./tree/__fixtures__/shuffled-keys.json";
import uniqHeaders from "./tree/__fixtures__/uniq-headers.json";

interface RenderFixture {
  name: string;
  options: Record<string, unknown>;
  input: JSONValue;
}

const renderFixtures = [
  objects,
  nestedArrays,
  collapsedIndexes,
  deduplication,
  emptyArrays,
  indexesDeduplication,
  simpleHeadersDuplication,
  uniqHeaders,
  multilineHeaders,
  noHeaderDedup,
  partiallyDifferentHeaders,
  shuffledKeys,
  fullyDeduplicated,
  formatInBothItems,
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
    expect(`\n${toASCII(tree, { format: ASCIITableFormat.MarkdownLike })}`)
      .toMatchSnapshot(`${name} markdown-like`);
  });

  it("renders expected html table", () => {
    expect(toHTML(tree)).toMatchSnapshot(`${name} html`);
  });
});
