import { MarketingFooter } from "~/components/marketing/marketing-footer";
import { MarketingNav } from "~/components/marketing/marketing-nav";

/**
 * The public shell. Deliberately outside `(app)` — no sidebar, no tRPC
 * prefetch, no forced-dynamic render: this page is reachable signed-out and
 * should be cheap to serve.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background text-foreground min-h-dvh">
      {/* Scroll-reveal starts its sections displaced and settles them with an
          IntersectionObserver. Without JS there is no observer, so unhide. */}
      <noscript>
        <style>{`.lp-reveal { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>
      <a
        className="bg-lp-brand text-lp-on-brand focus:ring-ring/50 sr-only rounded-lg px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:ring-3"
        href="#main"
      >
        Skip to content
      </a>
      <MarketingNav />
      <main id="main">{children}</main>
      <MarketingFooter />
    </div>
  );
}
