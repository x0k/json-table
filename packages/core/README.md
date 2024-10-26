# @json-table/core

Set of tools for converting JSON data to table (HTML, XLSX, ASCII).

- [Web App](https://x0k.github.io/json-table/)
- [Documentation](https://x0k.github.io/json-table/docs/)

## Install

```shell
npm install @json-table/core
```

## Usage

```typescript
import { makeTableInPlaceBaker, makeTableFactory } from "@json-table/core/json-to-table";
import { blockToASCII } from "@json-table/core/block-to-ascii";

const cornerCellValue = "№";
const factory = makeTableFactory({ cornerCellValue });
const bake = makeTableInPlaceBaker({ cornerCellValue, head: true, indexes: true });
const asciiTable = blockToASCII(bake(factory(data)));
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
