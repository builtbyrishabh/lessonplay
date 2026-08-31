import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything is behind Clerk except the auth pages, the public homepage, and
// the legal pages — Google's OAuth review fetches /privacy and /terms
// unauthenticated, so a redirect to sign-in there reads as a broken link.
//
// The last three are for robots, not people, and the matcher below already
// skips them so this never runs. They stay listed as a safety net: gate them
// by accident and Googlebot gets a sign-in redirect where it expects a file,
// and every shared link loses its preview card — all of it silent.
const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy",
  "/terms",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files. `txt`/`xml` cover robots and
    // the sitemap, and `opengraph-image` is named outright because its
    // generated route carries a content hash instead of an extension: all
    // three are fetched by crawlers that hold no session, so running auth on
    // them buys nothing and bills a middleware invocation per hit.
    "/((?!_next|opengraph-image|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
