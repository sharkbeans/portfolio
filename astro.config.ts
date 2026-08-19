import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

import { profile } from "./src/data/profile";

export default defineConfig({
  site: profile.site,
  base: "/",
  output: "static",
  // GitHub Pages 301-redirects extensionless paths like /projects to
  // /projects/ (the static build always emits path/index.html). Matching
  // that here makes astro dev redirect the same way, so a missing trailing
  // slash shows up locally instead of only as an extra round trip in prod.
  trailingSlash: "always",
  // Every page is tiny and static, so prefetching everything in view removes
  // the fetch-then-transition dead time that otherwise shows up as a stall
  // before the view transition starts (worst on the nav wheel, which has no
  // hover phase before it commits).
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  integrations: [mdx(), sitemap()],
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
