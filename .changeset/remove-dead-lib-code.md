---
"@json-table/core": minor
---

Remove dead code from `lib/`:

- Remove deprecated `isRecord` from `object.ts` (use `isPlainObject` instead)
- Remove unused `matrix.ts` (`transpose`, `horizontalMirror`, `verticalMirror`, `mapCell`)
- Inline `matrix` call in `tree-to-ascii.ts`
