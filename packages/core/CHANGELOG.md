# @json-table/core

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
