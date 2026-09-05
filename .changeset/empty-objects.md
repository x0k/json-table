---
"@json-table/core": minor
---

Render empty objects through `emptyCellValue`: `{}` becomes a one-cell filler (nested under its header like any other value, indexed inside arrays) instead of a degenerate zero-width table. The `EmptyCellInfo` type gains an `"empty-object"` variant alongside `"gap"` and `"empty-array"`; like other fillers it bypasses `createLeaf`.

**BREAKING CHANGE**: `EmptyCellInfo["type"]` has a third variant — exhaustive switches over it need a new branch. Previously `{}` rendered as nothing (a zero-width row); any snapshot of that output will change.
