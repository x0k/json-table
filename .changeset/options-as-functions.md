---
"@json-table/core": minor
---

Make layout options function-only and add value hooks: `joinPrimitiveArrayValues` is renamed to `joinArrayValues` taking `(values) => leaf | undefined` (`undefined` declines merging and renders the array as a table), `proportionalSizeAdjustmentThreshold` is renamed to `isProportionalResize` taking a `ProportionalResizeGuard`, plus new `createLeaf` (formats data leaf values) and `emptyCellValue` (`(info) => leaf`, distinguishing `"gap"` filler from `"empty-array"` via `EmptyCellInfo`) options. Also exports a `joinPrimitiveArrayValues` helper reproducing the old default join.

**BREAKING CHANGE**: boolean `joinPrimitiveArrayValues` and numeric `proportionalSizeAdjustmentThreshold` no longer exist — non-function values throw a migration error at factory construction. Migrate `joinPrimitiveArrayValues: true` to `joinArrayValues: joinPrimitiveArrayValues` (imported from `@json-table/core`) and a threshold `n` to `isProportionalResize: makeProportionalResizeGuard(n)`.
