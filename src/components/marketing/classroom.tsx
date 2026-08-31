import { Reveal } from "~/components/marketing/reveal";
import { Container, SectionHeading } from "~/components/marketing/section";
import {
  ClockIcon,
  LightningIcon,
  ShareIcon,
  UsersIcon,
} from "~/lib/icons";

const POINTS = [
  {
    icon: ShareIcon,
    title: "One link, any device",
    body: "Phones, the lab desktops, a projector at the front. Students click and play — no accounts, no installs, nothing for IT to approve.",
  },
  {
    icon: ClockIcon,
    title: "Fits a period",
    body: "Games are built to be finished in a class, not a term. Levels are short enough to run one as a warm-up or hand the whole thing out as homework.",
  },
  {
    icon: UsersIcon,
    title: "Every version keeps working",
    body: "Publish again and the old link still plays the old game. Change a level in March without breaking what you sent in January.",
  },
  {
    icon: LightningIcon,
    title: "Change it in a sentence",
    body: "“Make level 3 harder.” “Use the words from our textbook.” “Add a step for safety goggles.” Come back any time and say what you want different.",
  },
] as const;

export function Classroom() {
  return (
    <section className="relative py-20 sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
          <SectionHeading
            className="lg:sticky lg:top-24"
            eyebrow="In the classroom"
            lead="Built around how a lesson actually runs — a shared link, a short session, and a teacher who wants to change one thing after seeing it used."
            title="Made for a real period, not a demo"
          />

          <ul className="grid gap-5 sm:grid-cols-2">
            {POINTS.map((point, i) => (
              <Reveal as="li" delay={i * 80} key={point.title}>
                <div className="border-border bg-card h-full rounded-2xl border p-6 shadow-sm">
                  <span className="bg-lp-cyan/10 text-lp-cyan flex size-10 items-center justify-center rounded-xl">
                    <point.icon className="size-4.5" />
                  </span>
                  <h3 className="text-foreground mt-4 text-[15px] font-semibold">
                    {point.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {point.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
