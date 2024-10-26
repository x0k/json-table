import type { Block } from '@json-table/core';
import { blockToHTML } from '@json-table/core/block-to-html';

import type { Entry } from '@/lib/entry';

export const HTML_TABLE_STYLES = `table, th, td {border: 1px solid black; border-collapse: collapse;} th, td {padding: 5px; text-align: left;} th:has(> b), td:has(> b) {text-align: center;}`;

export const renderHTMLPage = (
  title: string,
  content: string,
  style = ""
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    ${style}
  </style>
</head>
<body>
  ${content}
</body>
</html>`;

export function makeHTMLPageContent(tables: Entry<Block>[]) {
  return tables.length > 1
    ? tables
        .map(([title, table]) => `<h2>${title}</h2>${blockToHTML(table)}`)
        .join("<br />")
    : blockToHTML(tables[0]![1]);
}
