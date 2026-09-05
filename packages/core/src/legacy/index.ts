/**
 * Legacy Block/Table pipeline, restored from `@json-table/core@0.3.0`.
 *
 * Mirrors the 0.3.0 export surface (root model plus the `block`,
 * `block-matrix`, `block-to-ascii`, `block-to-html` and `json-to-table`
 * modules) as a single entry point. For new code, use the root
 * Tree-based API instead.
 */
export * from "./json-table.js";
export * from "./block/index.js";
export * from "./block-matrix.js";
export * from "./block-to-ascii/index.js";
export * from "./block-to-html.js";
export * from "./json-to-table/index.js";
