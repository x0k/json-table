// @ts-check
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import svelte from "@astrojs/svelte";

// https://astro.build/config
export default defineConfig({
  site: "https://x0k.github.io",
  base: "/json-table/docs/",
  trailingSlash: "always",
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  integrations: [
    svelte(),
    starlight({
      title: "JSON Table",
      social: {
        github: "https://github.com/x0k/json-table",
      },
      head: [
        {
          tag: "script",
          attrs: {
            "data-goatcounter": "https://json-table.counter.x0k.online/count",
            async: true,
            src: "https://json-table.counter.x0k.online/count.js",
          },
        },
      ],
      sidebar: [
        {
          label: "Packages",
          items: [
            {
              label: "@json-table/core",
              link: "/",
            },
            {
              label: "@json-table/block-to-xlsx",
              link: "/block-to-xlsx/",
            },
          ],
        },
      ],
      components: {
        Head: "./src/components/custom-head.astro",
        Header: "./src/components/header-with-links.astro",
      },
    }),
  ],
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
});
