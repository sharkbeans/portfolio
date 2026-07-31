import rss from "@astrojs/rss";
import { getCollection, type CollectionEntry } from "astro:content";

import { profile } from "../data/profile";

export async function GET(context: { site: URL }) {
  const allPosts: CollectionEntry<"blog">[] = await getCollection("blog");
  const posts = allPosts
    .filter((entry) => !entry.data.draft)
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  return rss({
    title: `${profile.handle} / blog`,
    description: "Project notes and development writing.",
    site: context.site,
    items: posts.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.pubDate,
      link: `/blog/${entry.id}/`,
    })),
  });
}
