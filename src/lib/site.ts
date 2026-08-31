/**
 * Canonical origin for anything a crawler or a social card has to resolve.
 *
 * `www` rather than the apex on purpose: Vercel 308s `lessonplay.space` to
 * `www.lessonplay.space`, so www is the host that actually answers 200 and the
 * one Google settles on as canonical. Putting the apex here would make every
 * sitemap entry and every `og:image` URL a redirect before it resolves.
 */
export const SITE_URL = "https://www.lessonplay.space";
