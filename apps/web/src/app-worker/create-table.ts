import { escapeHtml } from "@json-table/core/lib/html";
import { type JSONValue, isJsonPrimitive } from "@json-table/core/lib/json";
import { max, sum } from "@json-table/core/lib/math";
import type { Block } from "@json-table/core";
import { blockToASCII } from "@json-table/core/block-to-ascii";
import { makeBlockFactory } from "@json-table/core/json-to-table";

import { type Entry, transformValue } from "@/lib/entry";
import { createFileURL, createXLSBlob } from "@/lib/file";
import { JSONParseStatus, jsonTryParse } from "@/lib/json-parser";

import { renderHTMLPage, HTML_TABLE_STYLES, makeHTMLPageContent } from "./html";
import { makeWorkBook } from "./xlsx";

import {
  OutputFormat,
  type TransformConfig,
  extractTableFactoryOptions,
  makeTransformApplicator,
} from "./core";

function parseTableData(data: string): JSONValue {
  const dataParseResult = jsonTryParse<JSONValue>(data);
  return dataParseResult.status === JSONParseStatus.Ok
    ? dataParseResult.data
    : {
        Error: `An error occurred while trying to recognize the data:\n"${dataParseResult.error}"`,
      };
}

export async function createTable(
  data: string,
  transformConfig: TransformConfig
) {
  const options = extractTableFactoryOptions(transformConfig);
  const makeBlock = makeBlockFactory(options);
  const transformApplicator = makeTransformApplicator(transformConfig);
  const tableData = parseTableData(data);
  const pagesData: Entry<JSONValue>[] =
    isJsonPrimitive(tableData) || !transformConfig.paginate
      ? [["Report", tableData] as Entry<JSONValue>]
      : Array.isArray(tableData)
      ? tableData.map((item, i) => [String(i + 1), item] as Entry<JSONValue>)
      : Object.keys(tableData).map(
          (key) => [key, tableData[key]] as Entry<JSONValue>
        );
  const pagesTables = pagesData
    .map(transformValue(makeBlock))
    .map(transformValue(transformApplicator));
  switch (transformConfig.format) {
    case OutputFormat.HTML: {
      return renderHTMLPage(
        "Table",
        makeHTMLPageContent(pagesTables),
        HTML_TABLE_STYLES
      );
    }
    case OutputFormat.ASCII: {
      const renderTable = (t: Block) =>
        `<pre><code>${escapeHtml(
          blockToASCII(t, { format: transformConfig.asciiFormat })
        )}</code></pre>`;
      return renderHTMLPage(
        "Table",
        pagesTables.length > 1
          ? pagesTables
              .map(([title, table]) => `<h2>${title}</h2>${renderTable(table)}`)
              .join("<br />")
          : renderTable(pagesTables[0]![1])
      );
    }
    case OutputFormat.XLSX:
      return makeWorkBook(pagesTables, {
        columnWidth: (column, i, m, table) => {
          const counts = column.map((cell) => cell.count);
          return Math.max(
            Math.ceil(
              (counts.reduce(sum) / table.height +
                (counts.reduce(max) * column.length) / table.height) /
                2
            ),
            10
          );
        },
      })
        .xlsx.writeBuffer()
        .then(createXLSBlob)
        .then(createFileURL);
    default:
      throw new Error(`Unexpected output format`);
  }
}
