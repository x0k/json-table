import { mount } from "svelte";

import { isValidUrl } from "./lib/url";

import MainPage from "./main-page.svelte";
import DownloadTablePage from "./download-table-page.svelte";
import HtmlTablePage from "./html-table-page.svelte";
import { OutputFormat, type TransformConfig, TransformPreset } from "./core";
import { compressor, appWorker } from "./init";
import { fetchAsText, type SharedData } from "./model";
import "./app.css";

const target = document.getElementById("app")!;

function page() {
  let initialData = "";
  let initialOptions: TransformConfig = {
    preset: TransformPreset.Default,
    transform: false,
    format: OutputFormat.HTML,
    paginate: false,
  };
  const hash = location.hash.substring(1);
  if (hash !== "") {
    const { data, options, createOnOpen }: SharedData = JSON.parse(
      compressor.decompress(hash)
    );
    if (data) {
      initialData = data;
    }
    if (options) {
      initialOptions = options;
    }
    if (createOnOpen) {
      const table = isValidUrl(initialData)
        ? fetchAsText(initialData).then((data) =>
            appWorker.createTable({ data, config: initialOptions })
          )
        : appWorker.createTable({
            data: initialData,
            config: initialOptions,
          });
      switch (initialOptions.format) {
        case OutputFormat.XLSX:
          return mount(DownloadTablePage, {
            target,
            props: {
              title: "table.xlsx",
              content: table,
            },
          });
        default:
          return mount(HtmlTablePage, {
            target,
            props: {
              content: table,
            },
          });
      }
    }
  }
  return mount(MainPage, {
    target,
    props: {
      initialData,
      initialOptions,
    },
  });
}

export default page();
