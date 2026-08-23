import { escapeHtml } from "@json-table/core/lib/html";
import {
  type JSONPrimitive,
  type JSONValue,
  isJsonPrimitive,
} from "@json-table/core/lib/json";
import { type Tree, type TreeFactoryOptions, makeTreeFactory, toASCII } from "@json-table/core";

import { type Entry, transformValue } from "@/lib/entry";
import { JSONParseStatus, jsonTryParse } from "@/lib/json-parser";

import { renderHTMLPage, HTML_TABLE_STYLES, makeHTMLPageContent } from "./html";
import { makeWorkBook } from "./xlsx";
import {
  OutputFormat,
  type TransformConfig,
  extractTableFactoryOptions,
  makeTransformApplicator,
} from "./model";

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
  const makeTree = makeTreeFactory<JSONValue>(
    options as unknown as TreeFactoryOptions<JSONValue>
  );
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
    .map(transformValue(makeTree))
    .map(
      transformValue(
        transformApplicator as (t: Tree<JSONValue>) => Tree<JSONValue>
      )
    );
  switch (transformConfig.format) {
    case OutputFormat.HTML: {
      return renderHTMLPage(
        "Table",
        makeHTMLPageContent(pagesTables),
        HTML_TABLE_STYLES
      );
    }
    case OutputFormat.ASCII: {
      const renderTable = (t: Tree<JSONValue>) =>
        `<pre><code>${escapeHtml(
          toASCII(t, { format: transformConfig.asciiFormat })
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
      return makeWorkBook(pagesTables);
    default:
      throw new Error(`Unexpected output format`);
  }
}
