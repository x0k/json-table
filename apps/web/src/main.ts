import { mount } from "svelte";

import { isValidUrl } from "./lib/url";

import MainPage from "./main-page.svelte";
import DownloadTablePage from "./download-table-page.svelte";
import HtmlTablePage from "./html-table-page.svelte";
import {
  OutputFormat,
  type TransformConfig,
  TransformPreset,
} from "./app-worker";
import { compressor, appWorker } from "./init";
import { fetchAsText } from "./core";
import "./app.css";

const target = document.getElementById("app")!;

function page() {
  let initialData = "";
  let initialOptions: TransformConfig = {
    preset: TransformPreset.Default,
    transform: false,
    format: OutputFormat.HTML,
    paginate: false,
    createOnOpen: true,
  };
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has("data")) {
    try {
      initialData = compressor.decompress(searchParams.get("data")!) || "";
    } catch (error) {
      console.error(error);
    }
  }
  if (searchParams.has("options")) {
    try {
      initialOptions = JSON.parse(
        compressor.decompress(searchParams.get("options")!)
      );
    } catch (error) {
      console.error(error);
    }
  }
  if (searchParams.get("createOnOpen") === "true") {
    const table = isValidUrl(initialData)
      ? fetchAsText(initialData).then((data) =>
          appWorker.createTable(data, initialOptions)
        )
      : appWorker.createTable(initialData, initialOptions);
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
  return mount(MainPage, {
    target,
    props: {
      initialData,
      initialOptions,
    },
  });
}

export default page();
