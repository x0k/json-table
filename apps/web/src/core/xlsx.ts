import type { Tree } from "@json-table/core";
import type { JSONValue } from "@json-table/core/lib/json";
import { treesToXlsxBytes, type RenderOptions } from "@json-table/xlsx";

import type { Entry } from "@/lib/entry";
import { createXLSBlob, createFileURL } from "@/lib/file";

export function makeWorkBook(
  tables: Entry<Tree<JSONValue>>[],
  options?: RenderOptions
): Promise<string> {
  return treesToXlsxBytes(tables, options)
    .then((bytes) => new Uint8Array(bytes))
    .then(createXLSBlob)
    .then(createFileURL);
}
