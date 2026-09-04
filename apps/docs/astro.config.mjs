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
      social: [
        {
          icon: "discord",
          href: "https://discord.gg/hVxFWk7dRn",
          label: "Discord",
        },
        {
          icon: "github",
          href: "https://github.com/x0k/json-table",
          label: "GitHub",
        },
      ],
      head: [
        {
          tag: "script",
          attrs: {
            "data-goatcounter": "https://json-table.counter.x0k.dev/count",
            async: true,
            src: "https://json-table.counter.x0k.dev/count.js",
          },
        },
      ],
      sidebar: [
        {
          label: "Packages",
          items: [
            {
              label: "Core",
              items: [
                {
                  label: "Overview",
                  link: "/",
                },
                {
                  label: "Factory options",
                  link: "/factory-options/",
                },
                {
                  label: "Renderers",
                  link: "/renderers/",
                },
                {
                  label: "Layout transforms",
                  link: "/transforms/",
                },
              ],
            },
            {
              label: "@json-table/xlsx",
              link: "/xlsx/",
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
