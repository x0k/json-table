import { bench, describe } from "vitest";

import type { JSONValue } from "./lib/json.js";
import { makeTreeFactory } from "./json-to-tree.js";
import type { Tree } from "./model.js";
import { ASCIITableFormat, toASCII } from "./tree-to-ascii.js";
import { toHTML } from "./tree-to-html.js";

import company from "./__fixtures__/company.js";
import nestedArrays from "./__fixtures__/nested-arrays.js";

const createTree = makeTreeFactory<JSONValue>({
  cornerCellValue: "#",
  createHeader: (k: string) => k,
  createIndex: (i: number) => `${i + 1}`,
});

function build(input: unknown): Tree<JSONValue> {
  return createTree(input as JSONValue);
}

describe("renderers", () => {
  const companyTree = build(company.input);
  const nestedTree = build(nestedArrays.input);

  bench("toASCII company", () => {
    toASCII(companyTree);
  });
  bench("toASCII markdown-like company", () => {
    toASCII(companyTree, { format: ASCIITableFormat.MarkdownLike });
  });
  bench("toHTML company", () => {
    toHTML(companyTree);
  });
  bench("toASCII nested-arrays", () => {
    toASCII(nestedTree);
  });
  bench("toHTML nested-arrays", () => {
    toHTML(nestedTree);
  });
});
