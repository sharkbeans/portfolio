import { profile } from "../data/profile";

export function GET() {
  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${profile.site}/sitemap-index.xml\n`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
