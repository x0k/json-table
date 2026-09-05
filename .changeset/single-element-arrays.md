---
"@json-table/core": minor
---

Stop silently unwrapping single-element arrays: every array level now renders its index column with no special cases, so `[x]` renders distinctly from `x` and `[{ ... }]` from `{ ... }`. `joinArrayValues` runs before that, uniformly (empty arrays never reach it: they render as the `emptyCellValue` filler). In `collapseIndexes` mode nested levels flatten into dotted paths (`[[123]]` → `1.1 | 123`); a flat singleton (`[x]`) flattened nothing and renders bare, as do empty arrays.

**BREAKING CHANGE**: tables containing single-element arrays gain an index column (and, for object elements, a corner cell with a lifted header band) where previously the element was inlined without any array marker.
