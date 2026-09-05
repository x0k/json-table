# @json-table/core

Set of tools for converting JSON data into tables (HTML, XLSX, ASCII).

- [Web App](https://x0k.github.io/json-table/)
- [Documentation](https://x0k.github.io/json-table/docs/)
- [Discord](https://discord.gg/hVxFWk7dRn)

## Install

```shell
npm install @json-table/core
```

## How it works

Every JSON value is drawn as a rectangular block:

- a primitive (`string`, `number`, `boolean`, `null`) is a single cell;
- an object lays its properties out **side by side**, each key becoming a header above its value;
- an array stacks its items **vertically**, numbering each one.

Because every block is a rectangle, they compose naturally: a value nested inside another simply takes its place in the parent's layout, and neighbouring blocks align along shared edges — which is why arbitrarily deep JSON always produces a well-formed table.

Finally, repetition is removed: when all items of an array begin with the same header band (or the same index column), it is lifted out and drawn once at the top/left instead of repeating per item.

Rendering then just traces this layout into whatever output you need — ASCII, HTML, XLSX, or your own format.

## Usage

```typescript
import {
  makeTreeFactory,
  joinPrimitiveArrayValues,
  toASCII,
  toHTML,
} from "@json-table/core";

const createTree = makeTreeFactory({
  cornerCellValue: "№",
  createHeader: (key) => key,
  createIndex: (i) => i + 1,
  joinArrayValues: joinPrimitiveArrayValues,
});

const tree = createTree(data);

const asciiTable = toASCII(tree);

/* Or */

const htmlTable = toHTML(tree);
```

Input data:

```json
{
  "key": "val",
  "primitiveArr": [1, "two", false],
  "object": {
    "key1": "value1",
    "key2": 789,
    "key3": {
      "nestedKey": "nestedVal"
    }
  },
  "nestedArray": [
    {
      "name": "John",
      "age": 30,
      "isStud": false
    },
    {
      "name": "Alice",
      "age": 25,
      "isStud": true
    }
  ]
}
```

Output:

```
+-----+---------------+---------------------------+--------------------------+
| key | primitiveArr  |          object           |         nestedArray      |
+-----+---------------+--------+------+-----------+---+-------+-----+--------+
|     |               |  key1  | key2 |   key3    | № | name  | age | isStud |
|     |               +--------+------+-----------+---+-------+-----+--------+
| val | 1, two, false |        |      | nestedKey | 1 | John  |  30 | false  |
|     |               | value1 |  789 +-----------+---+-------+-----+--------+
|     |               |        |      | nestedVal | 2 | Alice |  25 | true   |
+-----+---------------+--------+------+-----------+---+-------+-----+--------+
```

## Factory options

`makeTreeFactory<V>(options)` accepts:

| Option | Default | Description |
| --- | --- | --- |
| `cornerCellValue` | — (required) | Value of the top-left corner cell above lifted header bands. |
| `createHeader` | — (required) | `(key, record) => leaf` — header cell for an object key. |
| `createIndex` | — (required) | `(i, array) => leaf` — index cell for array item `i`. |
| `createLeaf` | `identity` | `(value) => leaf` — formats data leaves (joined arrays included). Headers, indexes, corners and filler never pass here. |
| `joinArrayValues` | `undefined` | `(values) => leaf \| undefined` — merges an array into one leaf; return `undefined` to render it as a table. Receives raw input order, before key stabilization. Use `joinPrimitiveArrayValues` to comma-join all-primitive arrays (the pre-0.5 behavior). |
| `emptyCellValue` | `() => ""` | `({ type, width, height }) => leaf` — placeholder for content-less cells. `type` is `"gap"` (sizing filler), `"empty-array"` or `"empty-object"`. |
| `isProportionalResize` | allows 100% growth | `(lcm, max) => boolean` — guards LCM-scaling of sibling heights. Use `makeProportionalResizeGuard(threshold)`; when it rejects, short columns are padded with filler instead. |
| `collapseIndexes` | `false` | Flatten nested arrays into dotted index paths (`1.2`, …) instead of nested index columns. |
| `stabilizeOrderOfPropertiesInArraysOfObjects` | `true` | Reorder keys of objects inside an array by stable first-seen position, so columns line up. |
| `deduplicateHeaders` | `true` | Lift the header band common to all array items on top of the table. Set `false` to keep per-row headers. |
| `isHeaderEqual` | `Object.is` | `(a, b) => boolean` — custom equality for header values during band lifting. Needed when headers carry objects (see below). |

## Input handling

- Objects with a `toJSON()` method are unwrapped via `toJSON()` first.
- Objects exposing a `[TO_TABLE]()` method (import `TO_TABLE` from `@json-table/core`) bypass parsing with their prebuilt `Tree`.
- Every array level renders its index column — no special cases, so `[x]` stays distinguishable from `x` and `[{ ... }]` from `{ ... }`. `joinArrayValues` runs before that, uniformly (empty arrays never reach it: they render as the `emptyCellValue` filler). In `collapseIndexes` mode nested levels flatten into dotted paths (`[[123]]` → `1.1 | 123`); a flat singleton (`[x]`) flattened nothing and renders bare, as do empty arrays.
- Empty arrays render as one `empty-array` filler cell, empty objects as one `empty-object` filler cell (see `emptyCellValue`).
- Headers carrying objects never lift by identity alone: pass `isHeaderEqual` to compare them (e.g. by label). See the [interactive table example](https://svelte.dev/playground/2b3654db352247e8a2a4fea42d9621cc).

## Renderers

- `toASCII(tree, { format })` — `format` is `ASCIITableFormat.MySQL` (default) or `ASCIITableFormat.MarkdownLike`.
- `toHTML(tree)` — `<table>` with `colspan`/`rowspan`; header, index and corner cells are wrapped in `<b>`.
- XLSX — see [@json-table/xlsx](https://github.com/x0k/json-table/tree/main/packages/xlsx).

> [!TIP]
> Writing your own renderer is easy — `cells()` walks the tree and yields
> every cell with its position and span:
>
> ```typescript
> import { cells } from "@json-table/core";
>
> for (const { node, x, y, width, height } of cells(tree)) {
>   // node.type: "header" | "index" | "corner" | "leaf"
> }
> ```
>
> For HTML-like renderers, `rows()` groups cells into visual rows
> (one array per `<tr>`, ordered left-to-right; rows fully covered by
> rowspans are present but empty):
>
> ```typescript
> import { rows } from "@json-table/core";
>
> for (const row of rows(tree)) {
>   // each row: cells starting in it, sorted by x
> }
> ```
>
> See [tree-to-html](https://github.com/x0k/json-table/blob/main/packages/core/src/tree-to-html.ts)
> for a complete minimal renderer.
>
> [Interactive table example](https://svelte.dev/playground/2b3654db352247e8a2a4fea42d9621cc).

## Layout transforms

Trees can be transformed in place (or structurally) before rendering:

```typescript
import {
  transposeTree,
  horizontalMirrorInPlace,
  verticalMirrorInPlace,
  normalizeExtentsInPlace,
} from "@json-table/core";
```

- `transposeTree(tree)` — reflect over the main diagonal (rows become columns). Returns a new tree.
- `horizontalMirrorInPlace(tree)` — reverse column order.
- `verticalMirrorInPlace(tree)` — reverse row order.
- `normalizeExtentsInPlace(tree)` — recompute container extents bottom-up (sum along / max across). Useful after manual tree surgery.

## Benchmarks

```shell
pnpm --filter @json-table/core bench
```

Runs the `vitest bench` harness (`src/*.bench.ts`, excluded from tests,
builds and publishes): factory presets (default, `collapseIndexes`,
`joinPrimitiveArrayValues`) over fixtures plus synthetic large inputs (5k-row
lifting-pipeline stress, wide records, deep nesting), and `toASCII`/`toHTML`
over prebuilt trees. Deliberately outside the turbo pipeline and CI —
perf PRs must quote before/after numbers from it.

## Legacy Block API

The pre-0.4 `Block`/`Table` pipeline (as published in
`@json-table/core@0.3.0`) remains available unmodified under a subpath
export:

```typescript
import {
  makeTableFactory,
  makeBlockFactory,
  blockToASCII,
  blockToHTML,
} from "@json-table/core/legacy";
```

It mirrors the 0.3.0 export surface (root model plus `block`,
`block-matrix`, `block-to-ascii`, `block-to-html` and `json-to-table`
modules) in a single entry point. Prefer the root Tree-based API for new
code.

## License

MIT
