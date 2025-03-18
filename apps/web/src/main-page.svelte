<script lang="ts">
  import { fileOpen } from "browser-fs-access";
  import { overrideByRecord } from '@sjsf/form/lib/resolver'
  import {
    createForm,
    Content,
    FormTag,
    setFromContext,
    SubmitButton,
  } from "@sjsf/form";
  import { resolver } from "@sjsf/form/resolvers/compat";
  import "@sjsf/form/fields/extra-fields/enum-include";
  import { createFormValidator } from "@sjsf/ajv8-validator";
  import { theme as daisyTheme } from "@sjsf/daisyui5-theme";
  import { translation } from "@sjsf/form/translations/en";

  import { isValidUrl } from "./lib/url";
  import { copyTextToClipboard } from "./lib/copy-to-clipboard";
  import { makeDownloadFileByUrl } from "./lib/file";
  import { createPage } from "./lib/browser";

  import {
    fetchAsText,
    makeSource,
    resolveSource,
    ShareBehavior,
    SourceType,
    TRANSFORM_SCHEMA,
    TRANSFORM_UI_SCHEMA,
    type Source,
  } from "./core";
  import { OutputFormat, type TransformConfig } from "./app-worker";
  import { appWorker, compressor } from "./init";
  import Layout from "./layout.svelte";
  import ThemePicker from "./theme-picker.svelte";

  const {
    initialData,
    initialOptions,
  }: { initialData: string; initialOptions: TransformConfig } = $props();

  const validator = createFormValidator();

  let source: Source = $state({
    type: isValidUrl(initialData) ? SourceType.URL : SourceType.Text,
    data: initialData,
  });

  let shareBehavior = $state(ShareBehavior.CreateOnOpen);

  function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async function sample(name: string) {
    const data = await fetchAsText(`${name}.json`);
    source = { type: SourceType.Text, data };
  }

  async function shareTable() {
    const { value } = form;
    if (value === undefined) {
      return;
    }
    const url = new URL(window.location.href);
    const { data } = source;
    if (shareBehavior === ShareBehavior.CreateOnOpen) {
      url.searchParams.set("createOnOpen", "true");
    } else {
      url.searchParams.delete("createOnOpen");
    }
    url.searchParams.set("options", compressor.compress(JSON.stringify(value)));
    url.searchParams.set("data", data && compressor.compress(data));
    const urlStr = url.toString();
    copyTextToClipboard(urlStr)
      .then(() => {
        if (urlStr.length > 2000) {
          window.alert("URL is too long");
          // toast({
          //   title: "URL is too long",
          //   description:
          //     "URL is copied to clipboard, but it's too long for a browsers",
          //   status: "warning",
          // });
        } else {
          window.alert("URL copied to the clipboard");
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

  let theme = $state<"light" | "dark" | "system">(
    localStorage.theme ?? "system"
  );

  const form = createForm({
    resolver,
    theme: daisyTheme,
    initialValue: initialOptions,
    schema: TRANSFORM_SCHEMA,
    uiSchema: TRANSFORM_UI_SCHEMA,
    validator,
    translation: overrideByRecord(translation, {
      submit: "Create table"
    }),
    onSubmit: (formData) => {
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
    },
  });
  setFromContext(form.context);
</script>

<Layout>
  {#snippet append()}
    <a
      class="btn btn-circle btn-ghost"
      aria-label="docs"
      href="https://x0k.github.io/json-table/docs/"
      target="_blank"
    >
      <svg
        viewBox="0 0 48 48"
        class="w-8 h-8"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5 7H16C20.4183 7 24 10.5817 24 15V42C24 38.6863 21.3137 36 18 36H5V7Z"
          fill="none"
          stroke="currentColor"
          stroke-width="4"
          stroke-linejoin="bevel"
        ></path><path
          d="M43 7H32C27.5817 7 24 10.5817 24 15V42C24 38.6863 26.6863 36 30 36H43V7Z"
          fill="none"
          stroke="currentColor"
          stroke-width="4"
          stroke-linejoin="bevel"
        ></path>
      </svg>
    </a>
    <a
      class="btn btn-circle btn-ghost"
      aria-label="github"
      href="https://github.com/x0k/json-table"
      target="_blank"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        version="1.1"
        class="w-8 h-8 fill-base-content"
      >
        <path
          d="M12.5.75C6.146.75 1 5.896 1 12.25c0 5.089 3.292 9.387 7.863 10.91.575.101.79-.244.79-.546 0-.273-.014-1.178-.014-2.142-2.889.532-3.636-.704-3.866-1.35-.13-.331-.69-1.352-1.18-1.625-.402-.216-.977-.748-.014-.762.906-.014 1.553.834 1.769 1.179 1.035 1.74 2.688 1.25 3.349.948.1-.747.402-1.25.733-1.538-2.559-.287-5.232-1.279-5.232-5.678 0-1.25.445-2.285 1.178-3.09-.115-.288-.517-1.467.115-3.048 0 0 .963-.302 3.163 1.179.92-.259 1.897-.388 2.875-.388.977 0 1.955.13 2.875.388 2.2-1.495 3.162-1.179 3.162-1.179.633 1.581.23 2.76.115 3.048.733.805 1.179 1.825 1.179 3.09 0 4.413-2.688 5.39-5.247 5.678.417.36.776 1.05.776 2.128 0 1.538-.014 2.774-.014 3.162 0 .302.216.662.79.547C20.709 21.637 24 17.324 24 12.25 24 5.896 18.854.75 12.5.75Z"
        ></path>
      </svg>
    </a>
    <ThemePicker bind:theme />
  {/snippet}
  <div class="flex gap-2 items-center">
    <p>Source type:</p>
    {#each Object.values(SourceType) as type}
      <div class="form-control">
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            bind:group={source.type}
            onchange={() => {
              source = makeSource(source.type);
            }}
            value={type}
            class="radio"
          />
          <span class="label-text">{capitalize(type)}</span>
        </label>
      </div>
    {/each}
    <div class="ml-auto join">
      <select bind:value={shareBehavior} class="select select-accent join-item">
        <option value={ShareBehavior.CreateOnOpen}>Create on open</option>
        <option value={ShareBehavior.OpenEditor}>Open editor</option>
      </select>
      <button class="btn btn-accent join-item" onclick={shareTable}>
        Share
      </button>
    </div>
  </div>
  {#if source.type === SourceType.Text}
    <textarea
      class="textarea textarea-bordered font-mono w-full"
      placeholder="Paste JSON here"
      bind:value={source.data}
      rows="25"
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
      class="input input-bordered w-full"
      type="url"
    />
  {/if}
  <FormTag>
    <SubmitButton />
    <Content />
  </FormTag>
</Layout>
