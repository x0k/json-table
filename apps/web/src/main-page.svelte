<script lang="ts">
  import { fileOpen } from "browser-fs-access";
  import Ajv from "ajv";
  import { FormBase } from "@sjsf/form";
  import {
    AjvValidator,
    DEFAULT_AJV_CONFIG,
    addFormComponents,
  } from "@sjsf/ajv8-validator";
  import { theme as daisyTheme } from "@sjsf/daisyui-theme";
  import { translation } from "@sjsf/form/translations/en";

  import { isValidUrl } from "./lib/url";
  import { copyTextToClipboard } from "./lib/copy-to-clipboard";
  import { makeDownloadFileByUrl } from './lib/file';
  import { createPage } from './lib/browser';

  import {
    fetchAsText,
    makeSource,
    resolveSource,
    SourceType,
    TRANSFORM_SCHEMA,
    TRANSFORMED_UI_SCHEMA,
    type Source,
  } from "./core";
  import { OutputFormat, type TransformConfig } from "./app-worker";
  import { appWorker, compressor } from "./init";
  import Layout from "./layout.svelte";
  import ThemePicker from './theme-picker.svelte';

  const {
    initialData,
    initialOptions,
  }: { initialData: string; initialOptions: TransformConfig } = $props();

  let source: Source = $state({
    type: isValidUrl(initialData) ? SourceType.URL : SourceType.Text,
    data: initialData,
  });
  let transformData = $state(initialOptions);
  const validator = new AjvValidator(
    addFormComponents(new Ajv(DEFAULT_AJV_CONFIG))
  );

  let form = $state<HTMLFormElement>();

  function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async function sample(name: string) {
    const data = await fetchAsText(`${name}.json`);
    source = { type: SourceType.Text, data };
  }

  const stringifyData = (data: string) => data && compressor.compress(data);
  const stringifyOptions = (options: TransformConfig) =>
    compressor.compress(JSON.stringify(options));

  async function shareTable() {
    const url = `${window.location.href}?createOnOpen=${
      transformData.createOnOpen
    }&data=${stringifyData(source.data)}&options=${stringifyOptions(
      transformData
    )}`;
    copyTextToClipboard(url)
      .then(() => {
        if (url.length > 2000) {
          window.alert("URL is too long");
          // toast({
          //   title: "URL is too long",
          //   description:
          //     "URL is copied to clipboard, but it's too long for a browsers",
          //   status: "warning",
          // });
        } else {
          window.alert("URL copied to clipboard");
          // toast({
          //   title: "URL copied to clipboard",
          //   status: "success",
          // });
        }
      })
      .catch((err): void => {
        window.alert("Failed to copy URL to clipboard");
        // toast({
        //   title: "Failed to copy URL to clipboard",
        //   status: "error",
        //   description: String(err),
        // });
      });
  }

  let theme = $state<"light" | "dark" | "system">(localStorage.theme ?? "system");
</script>

<Layout>
  {#snippet append()}
    <ThemePicker bind:theme />
    <a
      class="btn btn-circle btn-ghost"
      aria-label="github"
      href="https://github.com/x0k/json-to-table"
      target="_blank"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" version="1.1" class="w-8 h-8 cursor-pointer fill-base-content">
        <path d="M12.5.75C6.146.75 1 5.896 1 12.25c0 5.089 3.292 9.387 7.863 10.91.575.101.79-.244.79-.546 0-.273-.014-1.178-.014-2.142-2.889.532-3.636-.704-3.866-1.35-.13-.331-.69-1.352-1.18-1.625-.402-.216-.977-.748-.014-.762.906-.014 1.553.834 1.769 1.179 1.035 1.74 2.688 1.25 3.349.948.1-.747.402-1.25.733-1.538-2.559-.287-5.232-1.279-5.232-5.678 0-1.25.445-2.285 1.178-3.09-.115-.288-.517-1.467.115-3.048 0 0 .963-.302 3.163 1.179.92-.259 1.897-.388 2.875-.388.977 0 1.955.13 2.875.388 2.2-1.495 3.162-1.179 3.162-1.179.633 1.581.23 2.76.115 3.048.733.805 1.179 1.825 1.179 3.09 0 4.413-2.688 5.39-5.247 5.678.417.36.776 1.05.776 2.128 0 1.538-.014 2.774-.014 3.162 0 .302.216.662.79.547C20.709 21.637 24 17.324 24 12.25 24 5.896 18.854.75 12.5.75Z"></path>
      </svg>
    </a>
  {/snippet}
  <div class="flex gap-2 items-center">
    <p>Source type:</p>
    {#each Object.values(SourceType) as type}
      <div class="form-control">
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            bind:group={source.type}
            onchange={() => { source = makeSource(source.type) }}
            value={type}
            class="radio"
          />
          <span class="label-text">{capitalize(type)}</span>
        </label>
      </div>
    {/each}
    <button class="btn btn-secondary ml-auto" onclick={shareTable}>
      Share your table
    </button>
  </div>
  {#if source.type === SourceType.Text}
    <textarea
      class="textarea textarea-bordered font-mono"
      placeholder="Paste JSON here"
      bind:value={source.data}
      autofocus
      rows="20"
    ></textarea>
    <div class="flex gap-2 items-center">
      <p>Examples:</p>
      <button class="btn" onclick={() => sample("test")}>Basic</button>
      <button class="btn" onclick={() => sample("deduplication")}>
        Deduplication
      </button>
      <button class="btn" onclick={() => sample("company")}>Company</button>
      <button class="btn" onclick={() => sample("large")}>Large</button>
    </div>
  {:else if source.type === SourceType.File}
    <button
      class="btn"
      onclick={async () => {
        const file = await fileOpen();
        const data = await file.text();
        source = { type: SourceType.File, data, fileName: file.name };
      }}
    >
      {source.data ? source.fileName : "Select file"}
    </button>
  {:else if source.type === SourceType.URL}
    <input
      placeholder="File URL"
      bind:value={source.data}
      class="input input-bordered"
      type="url"
    />
  {/if}
  <button
    class="btn btn-primary"
    type="submit"
    onclick={() => form?.requestSubmit()}
  >
    Create Table
  </button>
  <FormBase
    {...daisyTheme}
    bind:form
    bind:value={transformData}
    schema={TRANSFORM_SCHEMA}
    uiSchema={TRANSFORMED_UI_SCHEMA}
    {validator}
    {translation}
    onSubmit={(formData) => {
      const cfg = formData as TransformConfig;
      resolveSource(source)
        .then((data) => appWorker.createTable(data, cfg))
        .then((content) => {
          switch (cfg.format) {
            case OutputFormat.XLSX:
              makeDownloadFileByUrl("table.xlsx")(content);
              return;
            default:
              createPage(content);
          }
        })
        .catch((e) => {
          window.alert(String(e));
          // toast({
          //   title: "Error",
          //   description: e,
          //   status: "error",
          // });
        });
    }}
  >
    {null}
  </FormBase>
</Layout>
