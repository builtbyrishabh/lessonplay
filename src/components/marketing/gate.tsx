import { Reveal } from "~/components/marketing/reveal";
import { Container, SectionHeading } from "~/components/marketing/section";
import {
  CheckCircleFillIcon,
  LayersIcon,
  PuzzleIcon,
  ShieldCheckIcon,
  TerminalIcon,
} from "~/lib/icons";

const CHECKS = [
  {
    icon: TerminalIcon,
    name: "It runs",
    body: "Structure, types and build. Every level is reachable and nothing dead-ends.",
    stamp: "structural",
  },
  {
    icon: PuzzleIcon,
    name: "It's a real puzzle",
    body: "Winnable from the evidence given, impossible to brute-force, and not on rails. A level that can be clicked through doesn't ship.",
    stamp: "quality",
  },
  {
    icon: LayersIcon,
    name: "It's been won",
    body: "The game is played all the way to a win through the same logic a player will hit. If it can't be finished, it isn't finished.",
    stamp: "replay",
  },
] as const;

export function Gate() {
  return (
    <section className="relative py-20 sm:py-28" id="gate">
      {/* This band is the page's one dark, "instrument panel" moment — it's the
          claim that most deserves to feel like machinery rather than marketing. */}
      <Container>
        <Reveal>
          <div className="border-border relative overflow-hidden rounded-3xl border bg-[color-mix(in_oklch,var(--card),var(--foreground)_4%)] px-6 py-14 shadow-sm sm:px-12">
            <div
              aria-hidden="true"
              className="lp-grid-bg absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_70%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-32 left-1/2 size-[30rem] -translate-x-1/2 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, var(--lp-glow-b), transparent 65%)",
              }}
            />

            <div className="relative">
              <SectionHeading
                align="center"
                className="items-center text-center"
                eyebrow="The gate"
                lead="AI that writes games writes broken games. So nothing reaches you until it has proven itself against three checks — and the third one is a machine playing your game to a win."
                title="Every game is play-tested before you ever see it"
              />

              <div className="mt-12 grid gap-4 md:grid-cols-3">
                {CHECKS.map((check, i) => (
                  <Reveal delay={i * 90} key={check.name}>
                    <div className="border-border/80 bg-card/80 h-full rounded-2xl border p-6 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <span className="bg-lp-violet/10 text-lp-violet flex size-10 items-center justify-center rounded-xl">
                          <check.icon className="size-4.5" />
                        </span>
                        <span className="text-muted-foreground/70 font-mono text-[10px] tracking-[0.14em] uppercase">
                          {check.stamp}
                        </span>
                      </div>
                      <h3 className="text-foreground mt-4 flex items-center gap-2 text-base font-semibold">
                        {check.name}
                        <CheckCircleFillIcon className="text-lp-lime size-4" />
                      </h3>
                      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        {check.body}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>

              <Reveal className="mt-8" delay={280}>
                <p className="text-muted-foreground mx-auto flex max-w-2xl items-start justify-center gap-2.5 text-center text-sm leading-relaxed">
                  <ShieldCheckIcon className="text-lp-lime mt-0.5 size-4 shrink-0" />
                  <span>
                    A game that fails any check can&rsquo;t be published. The
                    studio reads the failure report, fixes it, and runs the gate
                    again — you just see the version that passed.
                  </span>
                </p>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
