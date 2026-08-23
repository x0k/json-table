---
"@json-table/core": minor
"@json-table/xlsx": minor
---

Replace the `Block` model with the `Tree` model (**breaking change**)

The legacy `Block`/`Table` pipeline has been removed. JSON is now converted into a `Tree` (`makeTreeFactory`), and renderers consume the tree directly via `cells()`.

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
| `renderBlockOnWorksheet(block)` (block-to-xlsx)                                                          | `renderOnWorksheet(tree)`                           |
| `@json-table/block-to-xlsx` package                                                                      | `@json-table/xlsx`                                  |
| `@json-table/core/lib/binary-tree`, `/lib/guards`                                               | removed (unused utilities)                          |
| `@json-table/core/lib/proportional-resize-guard`                                                | `ProportionalResizeGuard` type from root export     |

- `combineArraysOfObjects` option dropped; use explicit object merging before rendering

Renderers (`toASCII`, `toHTML`, `renderOnWorksheet`) consume a `Tree` and traverse it with `cells()`, which yields every cell once together with its matrix position (`x`, `y`) and span (`width`, `height`).
