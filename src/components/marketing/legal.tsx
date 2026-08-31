import { Container, Eyebrow } from "~/components/marketing/section";

/**
 * The shell both legal pages share. Narrower than the marketing sections
 * (`max-w-3xl`, not `max-w-6xl`) because these are read top-to-bottom rather
 * than scanned — long measure is what makes a policy unreadable.
 *
 * Deliberately not `Reveal`-wrapped: the landing page earns its scroll
 * animation, a policy someone was linked to should just be there.
 */
export function LegalPage({
  title,
  updated,
  lead,
  children,
}: {
  title: string;
  /** Human-readable, e.g. "31 August 2026". Shown verbatim. */
  updated: string;
  lead: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="py-20 sm:py-28">
      <Container className="max-w-3xl">
        <Eyebrow>Legal</Eyebrow>
        <h1 className="text-foreground mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Last updated {updated}
        </p>
        <p className="text-muted-foreground mt-6 text-base leading-relaxed text-pretty sm:text-lg">
          {lead}
        </p>
        <div className="mt-14 flex flex-col gap-10">{children}</div>
      </Container>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
        {heading}
      </h2>
      <div className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-lp-violet/60">
      {children}
    </ul>
  );
}
