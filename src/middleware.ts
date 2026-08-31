import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything is behind Clerk except the auth pages, the public homepage, and
// the legal pages — Google's OAuth review fetches /privacy and /terms
// unauthenticated, so a redirect to sign-in there reads as a broken link.
const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy",
  "/terms",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
