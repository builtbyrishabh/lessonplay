import { Reveal } from "~/components/marketing/reveal";
import { Container, SectionHeading } from "~/components/marketing/section";
import {
  BookOpenIcon,
  PlayIcon,
  ShareIcon,
  TerminalIcon,
} from "~/lib/icons";

const STEPS = [
  {
    icon: BookOpenIcon,
    title: "Describe the lesson",
    body: "Paste the chapter section, drop the PDF, or just name the concept. It reads the activities and works out what a student would actually have to figure out.",
  },
  {
    icon: TerminalIcon,
    title: "Watch it get built",
    body: "Rules, levels and code are written in front of you, file by file. No spinner, no black box — you can see exactly what it decided and why.",
  },
  {
    icon: PlayIcon,
    title: "Play it, then push back",
    body: "The game opens next to the chat. Too easy? Wrong vocabulary for your class? Say so in a sentence and it edits the real thing.",
  },
  {
    icon: ShareIcon,
    title: "Share one link",
    body: "Publish and you get a link. Students open it in any browser — no accounts, no installs, nothing to hand out but a URL.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="relative py-20 sm:py-28" id="how">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          lead="Four steps, and only the first one is work."
          title="From a chapter you already teach to a game your class can play — in one sitting."
        />

        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, i) => (
            <Reveal as="li" className="relative" delay={i * 80} key={step.title}>
              {/* Connector to the next step — drawn per item so the rail stops
                  at step four instead of trailing off the grid. */}
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="from-lp-violet/35 absolute top-6 -right-6 left-14 hidden h-px bg-gradient-to-r to-transparent lg:block"
                />
              ) : null}
              <div className="border-border bg-card text-lp-violet relative z-10 flex size-12 items-center justify-center rounded-xl border shadow-sm">
                <step.icon className="size-5" />
                <span className="border-border bg-background text-muted-foreground absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border font-mono text-[10px] font-semibold">
                  {i + 1}
                </span>
              </div>
              <h3 className="text-foreground mt-5 text-base font-semibold">
                {step.title}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {step.body}
              </p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
