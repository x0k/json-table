// @ts-check
import { fileURLToPath } from 'node:url'
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
      sidebar: [
        // {
        //   label: "Guides",
        //   autogenerate: { directory: "guides" },
        // },
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
