import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

import { profile } from "./src/data/profile";

export default defineConfig({
  site: profile.site,
  base: "/portfolio/",
  output: "static",
  // React exists purely for the snake-eater-ui components on /lab. Every one
  // of them is rendered without a client:* directive, so they are compiled to
  // static HTML at build time and no React runtime reaches the browser.
  integrations: [mdx(), react(), sitemap()],
  markdown: {
    processor: unified({
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "append",
            properties: {
              ariaLabel: "Link to section",
              className: ["heading-anchor"],
            },
            content: {
              type: "text",
              value: "#",
            },
          },
        ],
      ],
    }),
  },
  vite: {
    css: {
      devSourcemap: true,
    },
  },
});
