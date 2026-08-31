import { type MetadataRoute } from "next";

import { SITE_URL } from "~/lib/site";

/**
 * Only the marketing pages are worth crawling.
 *
 * Everything under `/chats` sits behind Clerk and answers a signed-out crawler
 * with a redirect anyway, and the auth pages are chrome rather than content —
 * naming them here keeps the crawl budget on the three pages that can rank.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/chats", "/api/", "/sign-in", "/sign-up"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
