# @json-table/core

## 0.5.0

### Minor Changes

- [#27](https://github.com/x0k/json-table/pull/27) [`9e305cf`](https://github.com/x0k/json-table/commit/9e305cf59cf3b0d954dc8259f2d3e381612e0a07) Thanks [@x0k](https://github.com/x0k)! - Render empty objects through `emptyCellValue`: `{}` becomes a one-cell filler (nested under its header like any other value, indexed inside arrays) instead of a degenerate zero-width table. The `EmptyCellInfo` type gains an `"empty-object"` variant alongside `"gap"` and `"empty-array"`; like other fillers it bypasses `createLeaf`.

  **BREAKING CHANGE**: `EmptyCellInfo["type"]` has a third variant — exhaustive switches over it need a new branch. Previously `{}` rendered as nothing (a zero-width row); any snapshot of that output will change.

- [#27](https://github.com/x0k/json-table/pull/27) [`c16d2d0`](https://github.com/x0k/json-table/commit/c16d2d0bcfb91641b07aac189cdef39a68969ecf) Thanks [@x0k](https://github.com/x0k)! - Restore the 0.3.0 `Block`/`Table` pipeline as a `legacy` submodule: `import { makeTableFactory } from "@json-table/core/legacy"`. It mirrors the 0.3.0 export surface (root model plus `block`, `block-matrix`, `block-to-ascii`, `block-to-html` and `json-to-table` modules) verbatim in a single entry point, including its original tests. Prefer the root Tree-based API for new code.

- [#24](https://github.com/x0k/json-table/pull/24) [`a0bdc3c`](https://github.com/x0k/json-table/commit/a0bdc3c12080a4213692130daafcb7fbbd767e0e) Thanks [@x0k](https://github.com/x0k)! - Make layout options function-only and add value hooks: `joinPrimitiveArrayValues` is renamed to `joinArrayValues` taking `(values) => leaf | undefined` (`undefined` declines merging and renders the array as a table), `proportionalSizeAdjustmentThreshold` is renamed to `isProportionalResize` taking a `ProportionalResizeGuard`, plus new `createLeaf` (formats data leaf values) and `emptyCellValue` (`(info) => leaf`, distinguishing `"gap"` filler from `"empty-array"` via `EmptyCellInfo`) options. Also exports a `joinPrimitiveArrayValues` helper reproducing the old default join.

  **BREAKING CHANGE**: boolean `joinPrimitiveArrayValues` and numeric `proportionalSizeAdjustmentThreshold` no longer exist — non-function values throw a migration error at factory construction. Migrate `joinPrimitiveArrayValues: true` to `joinArrayValues: joinPrimitiveArrayValues` (imported from `@json-table/core`) and a threshold `n` to `isProportionalResize: makeProportionalResizeGuard(n)`.

- [#25](https://github.com/x0k/json-table/pull/25) [`666e50a`](https://github.com/x0k/json-table/commit/666e50a86b8c6b7ff3d1d0a1c7d929411c733e01) Thanks [@x0k](https://github.com/x0k)! - Remove dead code from `lib/`:
  - Remove deprecated `isRecord` from `object.ts` (use `isPlainObject` instead)
  - Remove unused `matrix.ts` (`transpose`, `horizontalMirror`, `verticalMirror`, `mapCell`)
  - Inline `matrix` call in `tree-to-ascii.ts`

- [#27](https://github.com/x0k/json-table/pull/27) [`fa8d30c`](https://github.com/x0k/json-table/commit/fa8d30c32d28e9580ed837c49726a52147326715) Thanks [@x0k](https://github.com/x0k)! - Stop silently unwrapping single-element arrays: every array level now renders its index column with no special cases, so `[x]` renders distinctly from `x` and `[{ ... }]` from `{ ... }`. `joinArrayValues` runs before that, uniformly (empty arrays never reach it: they render as the `emptyCellValue` filler). In `collapseIndexes` mode nested levels flatten into dotted paths (`[[123]]` → `1.1 | 123`); a flat singleton (`[x]`) flattened nothing and renders bare, as do empty arrays.

  **BREAKING CHANGE**: tables containing single-element arrays gain an index column (and, for object elements, a corner cell with a lifted header band) where previously the element was inlined without any array marker.

- [#22](https://github.com/x0k/json-table/pull/22) [`4008554`](https://github.com/x0k/json-table/commit/400855416089b041693873f7573d91a45c082fb1) Thanks [@x0k](https://github.com/x0k)! - Add `isHeaderEqual` factory option: custom equality for header values during band lifting.

  **BREAKING CHANGE**: removes the unused `isTreeStructurallyEquals` utility and the `extractHeadersTree` helper from the public API, and renames `extractSubtree` to `intersectTrees`.

### Patch Changes

- [#27](https://github.com/x0k/json-table/pull/27) [`fa8d30c`](https://github.com/x0k/json-table/commit/fa8d30c32d28e9580ed837c49726a52147326715) Thanks [@x0k](https://github.com/x0k)! - Fix lifted band segment alignment: decapitated bodies narrower than their band segment (e.g. a bare filler where the band spans an indexed table) now span to the band width instead of leaving a trailing pad that shifted every later segment under the wrong header.

## 0.4.3

### Patch Changes

- [#20](https://github.com/x0k/json-table/pull/20) [`6e74d32`](https://github.com/x0k/json-table/commit/6e74d32e9660b8b0f9f2dc3c830347d9351b0c2c) Thanks [@x0k](https://github.com/x0k)! - Stop stretching the last data row over missing rows/columns. Side-by-side record columns and array rows are now equalized band/body separately: scalar-only blocks span (they read as "applies to all rows/columns"), data blocks scale by a uniform multiplier while the proportional resize guard allows it, and anything left over becomes an explicit empty cell instead of a misleading rowspan/colspan.

## 0.4.2

### Patch Changes

- [#18](https://github.com/x0k/json-table/pull/18) [`acde5a8`](https://github.com/x0k/json-table/commit/acde5a8311301fd1e03de26fe9fe2844e74cc0e9) Thanks [@x0k](https://github.com/x0k)! - Update README to reflect current API

## 0.4.1

### Patch Changes

- [`dbd44da`](https://github.com/x0k/json-table/commit/dbd44dabbb382853df9cae8862a66e0ebc264820) Thanks [@x0k](https://github.com/x0k)! - Skip header deduplication for arrays with heterogeneous rows instead of rendering a misleading partial header band

## 0.4.0

### Minor Changes

- [`a26a918`](https://github.com/x0k/json-table/commit/a26a918ebf134cbe3e9fb2e50bd6203b92fe5017) Thanks [@x0k](https://github.com/x0k)! - Replace the `Block` model with the `Tree` model (**breaking change**)

  The legacy `Block`/`Table` pipeline has been removed. JSON is now converted into a `Tree` (`makeTreeFactory`), which renderers consume directly via `cells()`.

  Migration guide:

  | Removed                                                                                         | Replacement                                         |
  | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
  | `makeBlockFactory` / `makeTableFactory`                                                         | `makeTreeFactory`                                   |
  | `Block`, `Table`, `ComposedTable`, `Cell`, `CellType` types                                     | `Tree`                                              |
  | `blockToASCII(block)`                                                                           | `toASCII(tree)`                                     |
  | `blockToHTML(block)`                                                                            | `toHTML(tree)`                                      |
  | `ASCIIToBlock`                                                                                  | removed                                             |
  | `createMatrix` / `fromMatrix` / `@json-table/core/block-matrix`                                 | `cells(tree)`                                       |
  | `treeToMatrix` / `Matrix<Cell>` interchange                                                     | renderers consume `Tree` directly                   |
  | `@json-table/core/json-to-table`, `/block`, `/block-to-ascii`, `/block-to-html` subpath exports | single root export `@json-table/core` (+ `./lib/*`) |
  | `@json-table/core/lib/binary-tree`, `/lib/guards`                                               | removed (unused utilities)                          |
  | `@json-table/core/lib/proportional-resize-guard`                                                | `ProportionalResizeGuard` type from root export     |
  - `combineArraysOfObjects` option dropped; use explicit object merging before rendering

  Renderers traverse a `Tree` with `cells()`, which yields every cell once together with its matrix position (`x`, `y`) and span (`width`, `height`).

## 0.3.0

### Minor Changes

- [#12](https://github.com/x0k/json-table/pull/12) [`a8eab26`](https://github.com/x0k/json-table/commit/a8eab264141ce5fd3433c07c6e199d4cd15feb1b) Thanks [@x0k](https://github.com/x0k)! - [BREAKING] Use `TO_TABLE` symbol instead of `toTable` method during table generation

## 0.2.0

### Minor Changes

- [#11](https://github.com/x0k/json-table/pull/11) [`e6a7a7e`](https://github.com/x0k/json-table/commit/e6a7a7e598c0dba2ee5b407fc2f9e55e579a8862) Thanks [@x0k](https://github.com/x0k)! - Execute `toTable` and `toJSON` methods during table generation

- [#10](https://github.com/x0k/json-table/pull/10) [`76dd5d5`](https://github.com/x0k/json-table/commit/76dd5d54e8be6ae554603f0a814bb33b1fc04951) Thanks [@x0k](https://github.com/x0k)! - Allow passing non-JSON values

- [`9e41f2a`](https://github.com/x0k/json-table/commit/9e41f2adac65b15692a1cd02abd86e8d34f5dd8c) Thanks [@x0k](https://github.com/x0k)! - Remove unused code from `lib/json` and `lib/ord`

### Patch Changes

- [#9](https://github.com/x0k/json-table/pull/9) [`0045eb0`](https://github.com/x0k/json-table/commit/0045eb0490a1b41e51b2ddafc9644a98187e7064) Thanks [@x0k](https://github.com/x0k)! - Fix plain object detection

## 0.1.0

### Minor Changes

- [`a089b62`](https://github.com/x0k/json-table/commit/a089b628379acfef7bf1b56a6e85235bb442ec3a) Thanks [@x0k](https://github.com/x0k)! - Add `makeBlockFactory` function
