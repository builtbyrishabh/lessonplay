import Link from "next/link";

import { Reveal } from "~/components/marketing/reveal";
import { Container } from "~/components/marketing/section";
import { ArrowRightIcon } from "~/lib/icons";

export function FinalCta() {
  return (
    <section className="relative py-20 sm:py-28">
      <Container>
        <Reveal>
          <div className="border-border relative isolate overflow-hidden rounded-3xl border px-6 py-16 text-center shadow-xl sm:px-12 sm:py-20">
            {/* The one saturated surface on the page — it should be obvious
                where the page has been leading. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10"
              style={{
                background:
                  "linear-gradient(120deg, var(--lp-brand), var(--lp-brand-2))",
              }}
            />
            <div
              aria-hidden="true"
              className="lp-grid-bg absolute inset-0 -z-10 opacity-20 mix-blend-overlay"
            />

            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
              Pick any chapter and see what it becomes.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty text-white/85">
              Paste it in and see what comes back. It takes one sentence and a
              few minutes, and it&rsquo;s free while we&rsquo;re in beta.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                className="text-lp-brand inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold shadow-lg transition-all hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none active:scale-[0.98]"
                href="/sign-up"
              >
                Build your first game
                <ArrowRightIcon className="size-4" />
              </Link>
              <a
                className="inline-flex h-12 items-center rounded-xl border border-white/30 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none"
                href="#how"
              >
                See how it works
              </a>
            </div>

            <p className="mt-7 text-xs text-white/70">
              Free beta · Chemistry, classes 8–10 · No card, no install
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
