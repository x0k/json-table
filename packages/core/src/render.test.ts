import { describe, expect, it } from "vitest";

import type { JSONValue } from "./lib/json";
import { ASCIITableFormat, toASCII } from "./tree-to-ascii";
import { toHTML } from "./tree-to-html";
import {
  cells,
  horizontalMirrorInPlace,
  normalizeExtentsInPlace,
  rows,
  transposeTree,
  verticalMirrorInPlace,
  type Tree,
} from "./model";
import { makeTreeFactory } from "./json-to-tree";

import collapsedIndexes from "./__fixtures__/collapsed-indexes.js";
import company from "./__fixtures__/company.js";
import companyMixedEmployees from "./__fixtures__/company-mixed-employees.js";
import deduplication from "./__fixtures__/deduplication.js";
import emptyArrays from "./__fixtures__/empty-arrays.js";
import formatInBothItems from "./__fixtures__/format-in-both-items.js";
import fullyDeduplicated from "./__fixtures__/fully-deduplicated.js";
import indexesDeduplication from "./__fixtures__/indexes-deduplication.js";
import joinPrimitiveValues from "./__fixtures__/parsing-error.js";
import multilineHeaders from "./__fixtures__/multiline-headers.js";
import nestedArrays from "./__fixtures__/nested-arrays.js";
import noHeaderDedup from "./__fixtures__/no-header-dedup.js";
import objects from "./__fixtures__/objects.js";
import partiallyDifferentHeaders from "./__fixtures__/partially-different-headers.js";
import shuffledKeys from "./__fixtures__/shuffled-keys.js";
import simpleHeadersDuplication from "./__fixtures__/simple-headers-duplication.js";
import uniqHeaders from "./__fixtures__/uniq-headers.js";
import wrongSizes from "./__fixtures__/wrong-sizes.js";
import departmentsProjects from "./__fixtures__/departments-projects.js";
import widthNonProportional from "./__fixtures__/width-non-proportional.js";

interface RenderFixture {
  name: string;
  options: Record<string, unknown>;
  input: JSONValue;
}

const renderFixtures = [
  collapsedIndexes,
  company,
  companyMixedEmployees,
  deduplication,
  departmentsProjects,
  widthNonProportional,
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

/**
 * Rectangle invariant: factory output must already satisfy the layout
 * extents (fixpoint of normalizeExtentsInPlace) and tile its W×H area
 * exactly — every slot covered once, no holes or overlaps — with renderers
 * tracing cells() as-is.
 */
function rectangleViolations(name: string, tree: Tree<JSONValue>): string[] {
  const failures: string[] = [];
  const renormed = JSON.parse(JSON.stringify(tree)) as Tree<JSONValue>;
  normalizeExtentsInPlace(renormed);
  if (JSON.stringify(renormed) !== JSON.stringify(tree)) {
    failures.push("extents not at fixpoint");
  }
  const { width: W, height: H } = tree;
  const grid: number[][] = Array.from(
    { length: H },
    () => new Array<number>(W).fill(0),
  );
  for (const cell of cells(tree)) {
    if (
      cell.width < 1 ||
      cell.height < 1 ||
      cell.x < 0 ||
      cell.y < 0 ||
      cell.x + cell.width > W ||
      cell.y + cell.height > H
    ) {
      failures.push(
        `bad span ${cell.width}x${cell.height} at ${cell.x},${cell.y} in ${W}x${H}`,
      );
      continue;
    }
    for (let y = cell.y; y < cell.y + cell.height; y++) {
      for (let x = cell.x; x < cell.x + cell.width; x++) {
        grid[y]![x]! += 1;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y]![x] !== 1) {
        failures.push(`slot ${x},${y} covered ${grid[y]![x]} times`);
      }
    }
  }
  if (rows(tree).length !== H) {
    failures.push(`rows() length ${rows(tree).length} !== height ${H}`);
  }
  const trCount = (toHTML(tree).match(/<tr>/g) ?? []).length;
  if (trCount !== H) {
    failures.push(`html has ${trCount} rows for height ${H}`);
  }
  return failures.map((f) => `${name}: ${f}`);
}

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

  it("produces a gap-free rectangle", () => {
    expect(rectangleViolations(name, tree)).toEqual([]);
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
    expect(rectangleViolations("company hmirror", tree)).toEqual([]);
  });

  it("renders expected vertically mirrored table", () => {
    const tree = createTree(companyInput);
    verticalMirrorInPlace(tree);
    expect(`\n${toASCII(tree)}`).toMatchSnapshot("company vmirror ascii");
    expect(rectangleViolations("company vmirror", tree)).toEqual([]);
  });

  it("renders expected transposed table", () => {
    const tree = transposeTree(createTree(companyInput));
    expect(`\n${toASCII(tree)}`).toMatchSnapshot("company transpose ascii");
    expect(() => toHTML(tree)).not.toThrow();
    expect(rectangleViolations("company transpose", tree)).toEqual([]);
  });
});
