---
"@json-table/xlsx": minor
---

Rename `@json-table/block-to-xlsx` to `@json-table/xlsx` (**breaking change**)

The package now consumes the `Tree` model from `@json-table/core` directly via `cells()`.

Migration guide:

| Removed                                       | Replacement               |
| --------------------------------------------- | ------------------------- |
| `@json-table/block-to-xlsx` package           | `@json-table/xlsx`        |
| `renderBlockOnWorksheet(block)` (block-to-xlsx) | `renderOnWorksheet(tree)` |

`renderOnWorksheet` consumes a `Tree` and traverses it with `cells()`, which yields every cell once together with its matrix position (`x`, `y`) and span (`width`, `height`).
