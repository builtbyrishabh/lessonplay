import { Reveal } from "~/components/marketing/reveal";
import { Container, SectionHeading } from "~/components/marketing/section";
import { CheckIcon, DropletIcon, LayersIcon, TargetIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";

const GAMES = [
  {
    icon: TargetIcon,
    kicker: "Discovery lab",
    title: "Make them figure it out",
    body: "The student meets an unknown and a bench of tools. Pick a test, run it, read what happened, narrow it down, commit an answer. The world stays consistent, so the only way through is reasoning — and guessing costs you.",
    fits: [
      "Identify the unknown salt, acid or gas",
      "Reactivity series — predict, then check",
      "Which separation method, and why that one",
    ],
    accent: "var(--lp-violet)",
  },
  {
    icon: DropletIcon,
    kicker: "Guided lab",
    title: "Run the experiment properly",
    body: "A faithful, phone-shaped run of a classroom activity: set up the apparatus, do it in the right order, and watch the real consequence of getting the order wrong. The NCERT activity, with the student's hands on it.",
    fits: [
      "Filtration, evaporation and crystallisation",
      "Paper chromatography end to end",
      "Sublimation and distillation setups",
    ],
    accent: "var(--lp-cyan)",
  },
] as const;

export function GameTypes() {
  return (
    <section className="relative py-20 sm:py-28" id="games">
      <Container>
        <SectionHeading
          eyebrow="What you can build"
          lead="Two kinds of game today, both built for chemistry. Every game is a real simulation with rules underneath — not a quiz with a lab-coat skin on it."
          title="Not a slideshow. Not a multiple-choice quiz."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {GAMES.map((game, i) => (
            <Reveal as="article" delay={i * 90} key={game.title}>
              <div className="group border-border bg-card relative h-full overflow-hidden rounded-2xl border p-7 shadow-sm transition-shadow duration-300 hover:shadow-xl">
                {/* Accent wash, keyed to the archetype. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full opacity-[0.13] blur-3xl transition-opacity duration-300 group-hover:opacity-25"
                  style={{ background: game.accent }}
                />
                <span
                  className="inline-flex size-11 items-center justify-center rounded-xl"
                  style={{
                    background: `color-mix(in oklch, ${game.accent}, transparent 88%)`,
                    color: game.accent,
                  }}
                >
                  <game.icon className="size-5" />
                </span>
                <p
                  className="mt-5 text-xs font-semibold tracking-[0.12em] uppercase"
                  style={{ color: game.accent }}
                >
                  {game.kicker}
                </p>
                <h3 className="text-foreground mt-2 text-xl font-semibold tracking-tight">
                  {game.title}
                </h3>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {game.body}
                </p>
                <ul className="mt-6 flex flex-col gap-2.5">
                  {game.fits.map((fit) => (
                    <li
                      className="text-foreground/85 flex items-start gap-2.5 text-sm"
                      key={fit}
                    >
                      <CheckIcon
                        className="mt-0.5 size-4 shrink-0"
                        style={{ color: game.accent }}
                      />
                      {fit}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-6" delay={180}>
          <div
            className={cn(
              "border-border/80 bg-muted/30 flex flex-col gap-3 rounded-2xl border border-dashed p-6",
              "sm:flex-row sm:items-center sm:gap-5",
            )}
          >
            <span className="bg-background border-border text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-xl border">
              <LayersIcon className="size-5" />
            </span>
            <div>
              <h3 className="text-foreground text-sm font-semibold">
                Physics and biology are next
              </h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                The beta is chemistry-only on purpose — one subject, done
                properly, before we widen it. The engine underneath is
                subject-agnostic, so the rest follows.
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
