---
"@json-table/core": minor
---

Restore the 0.3.0 `Block`/`Table` pipeline as a `legacy` submodule: `import { makeTableFactory } from "@json-table/core/legacy"`. It mirrors the 0.3.0 export surface (root model plus `block`, `block-matrix`, `block-to-ascii`, `block-to-html` and `json-to-table` modules) verbatim in a single entry point, including its original tests. Prefer the root Tree-based API for new code.
