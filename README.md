# JSON Table

Set of tools for converting JSON data into tables (HTML, XLSX, ASCII).

- [Web App](https://x0k.github.io/json-table/)
- [Documentation](https://x0k.github.io/json-table/docs/)

## Install

```shell
npm install @json-table/core
```

## Usage

```typescript
import { makeBlockFactory } from "@json-table/core/json-to-table";
import { blockToASCII } from "@json-table/core/block-to-ascii";

const block = makeBlockFactory({
  cornerCellValue: "№",
  joinPrimitiveArrayValues: true,
});
const asciiTable = blockToASCII(block(data));
```

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
