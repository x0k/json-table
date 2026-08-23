# JSON Table

Set of tools for converting JSON data into tables (HTML, XLSX, ASCII).

- [Web App](https://x0k.github.io/json-table/)
- [Documentation](https://x0k.github.io/json-table/docs/)
- [Discord](https://discord.gg/hVxFWk7dRn)

## Install

```shell
npm install @json-table/core
```

## How it works

Every JSON value is drawn as a rectangular block:

- a primitive (`string`, `number`, `boolean`, `null`) is a single cell;
- an object lays its properties out **side by side**, each key becoming a header above its value;
- an array stacks its items **vertically**, numbering each one.

Because every block is a rectangle, they compose naturally: a value nested inside another simply takes its place in the parent's layout, and neighbouring blocks align along shared edges — which is why arbitrarily deep JSON always produces a well-formed table.

Finally, repetition is removed: when all items of an array begin with the same header band (or the same index column), it is lifted out and drawn once at the top/left instead of repeating per item.

Rendering then just traces this layout into whatever output you need — ASCII, HTML, XLSX, or your own format.

## Usage

```typescript
import { makeTreeFactory, toASCII, toHTML } from "@json-table/core";

const createTree = makeTreeFactory({
  cornerCellValue: "№",
  createHeader: (key) => key,
  createIndex: (i) => i + 1,
  joinPrimitiveArrayValues: true,
});

const tree = createTree(data);

const asciiTable = toASCII(tree);

/* Or */

const htmlTable = toHTML(tree);
```

> [!TIP]
> Writing your own renderer is easy — `cells()` walks the tree and yields
> every cell with its position and span:
>
> ```typescript
> import { cells } from "@json-table/core";
>
> for (const { node, x, y, width, height } of cells(tree)) {
>   // node.type: "header" | "index" | "corner" | "leaf"
> }
> ```
>
> For HTML-like renderers, `rows()` groups cells into visual rows
> (one array per `<tr>`, ordered left-to-right):
>
> ```typescript
> import { rows } from "@json-table/core";
>
> for (const row of rows(tree)) {
>   // each row: cells starting in it, sorted by x
> }
> ```
>
> See [tree-to-html](https://github.com/x0k/json-table/blob/main/packages/core/src/tree-to-html.ts)
> for a complete minimal renderer.
>
> [Interactive table example](https://svelte.dev/playground/2b3654db352247e8a2a4fea42d9621cc).

Input data:

```json
{
  "key": "val",
  "primitiveArr": [1, "two", false],
  "object": {
    "key1": "value1",
    "key2": 789,
    "key3": {
      "nestedKey": "nestedVal"
    }
  },
  "nestedArray": [
    {
      "name": "John",
      "age": 30,
      "isStud": false
    },
    {
      "name": "Alice",
      "age": 25,
      "isStud": true
    }
  ]
}
```

Output:

```
+-----+---------------+---------------------------+--------------------------+
| key | primitiveArr  |          object           |         nestedArray      |
+-----+---------------+--------+------+-----------+---+-------+-----+--------+
|     |               |  key1  | key2 |   key3    | № | name  | age | isStud |
|     |               +--------+------+-----------+---+-------+-----+--------+
| val | 1, two, false |        |      | nestedKey | 1 | John  |  30 | false  |
|     |               | value1 |  789 +-----------+---+-------+-----+--------+
|     |               |        |      | nestedVal | 2 | Alice |  25 | true   |
+-----+---------------+--------+------+-----------+---+-------+-----+--------+
```

## License

MIT

## See also

- Use this app to render JSON responses as tables in your browser by [WebMaid](https://github.com/x0k/web-maid/tree/main/examples/json-to-table)
- Simple build automation tool [mk](https://github.com/x0k/mk)
