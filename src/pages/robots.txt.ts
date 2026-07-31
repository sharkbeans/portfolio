import { profile } from "../data/profile";

export function GET() {
  const base = import.meta.env.BASE_URL;

  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${profile.site}${base}sitemap-index.xml\n`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
