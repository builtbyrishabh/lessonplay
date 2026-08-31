import { type MetadataRoute } from "next";

import { SITE_URL } from "~/lib/site";

/**
 * The public surface is exactly three pages — the rest of the app is behind
 * Clerk, and a published game lives on the CDN under a random prefix that is
 * deliberately not discoverable.
 */

// Keep in step with the "Last updated" line both legal pages print.
const LEGAL_UPDATED = new Date("2026-08-31");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
