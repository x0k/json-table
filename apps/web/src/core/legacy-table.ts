import { escapeHtml } from "@json-table/core/lib/html";
import { type JSONValue, isJsonPrimitive } from "@json-table/core/lib/json";
import {
  ASCIITableFormat,
  type Block,
  blockToASCII,
  blockToHTML,
  makeBlockFactory,
  ASCIITableFormat as LegacyASCIITableFormat,
} from "@json-table/core/legacy";

import { type Entry, transformValue } from "@/lib/entry";
import { JSONParseStatus, jsonTryParse } from "@/lib/json-parser";

import { renderHTMLPage, HTML_TABLE_STYLES } from "./html";
import {
  OutputFormat,
  TableImplementation,
  type TransformConfig,
  extractLegacyTableFactoryOptions,
} from "./model";

function toLegacyASCIIFormat(format: ASCIITableFormat): LegacyASCIITableFormat {
  switch (format) {
    case ASCIITableFormat.MySQL:
      return LegacyASCIITableFormat.MySQL;
    case ASCIITableFormat.MarkdownLike:
      return LegacyASCIITableFormat.MarkdownLike;
  }
}

function parseTableData(data: string): JSONValue {
  const dataParseResult = jsonTryParse<JSONValue>(data);
  return dataParseResult.status === JSONParseStatus.Ok
    ? dataParseResult.data
    : {
        Error: `An error occurred while trying to recognize the data:\n"${dataParseResult.error}"`,
      };
}

export async function createLegacyTable(
  data: string,
  transformConfig: TransformConfig
) {
  if (
    (transformConfig.implementation ?? TableImplementation.Core) !==
    TableImplementation.Legacy
  ) {
    throw new Error(`Unexpected implementation`);
  }
  // NOTE: mirror/reflect/transpose applicators operate on Trees and have no
  // Block counterparts, so `transform` settings are ignored here.
  const bake = makeBlockFactory<JSONValue>(
    extractLegacyTableFactoryOptions(transformConfig)
  );
  const tableData = parseTableData(data);
  const pagesData: Entry<JSONValue>[] =
    isJsonPrimitive(tableData) || !transformConfig.paginate
      ? [["Report", tableData] as Entry<JSONValue>]
      : Array.isArray(tableData)
      ? tableData.map((item, i) => [String(i + 1), item] as Entry<JSONValue>)
      : Object.keys(tableData).map(
          (key) => [key, tableData[key]] as Entry<JSONValue>
        );
  const pagesTables: Entry<Block>[] = pagesData.map(transformValue(bake));
  switch (transformConfig.format) {
    case OutputFormat.HTML: {
      return renderHTMLPage(
        "Table",
        pagesTables.length > 1
          ? pagesTables
              .map(([title, table]) => `<h2>${title}</h2>${blockToHTML(table)}`)
              .join("<br />")
          : blockToHTML(pagesTables[0]![1]),
        HTML_TABLE_STYLES
      );
    }
    case OutputFormat.ASCII: {
      const renderTable = (t: Block) =>
        `<pre><code>${escapeHtml(
          blockToASCII(t, {
            format: toLegacyASCIIFormat(transformConfig.asciiFormat),
          })
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
      throw new Error(
        `XLSX output is not available for the legacy implementation`
      );
    default:
      throw new Error(`Unexpected output format`);
  }
}
