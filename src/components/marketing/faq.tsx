import { Reveal } from "~/components/marketing/reveal";
import { Container, SectionHeading } from "~/components/marketing/section";
import { PlusIcon } from "~/lib/icons";

const FAQS = [
  {
    q: "Do I need to know how to code?",
    a: "No. You write the way you'd brief a helpful assistant — in sentences. The studio writes and tests the code itself; the code panel is there if you're curious, not because you need it.",
  },
  {
    q: "What subjects work right now?",
    a: "Chemistry only. The beta is deliberately narrow: school chemistry, classes 8–10 — the kind of content in an NCERT chapter. Physics and biology use the same engine and are next.",
  },
  {
    q: "How long does a game take to build?",
    a: "A first playable version usually lands in a few minutes, while you watch. Tightening it — difficulty, wording, an extra level — is a sentence at a time after that.",
  },
  {
    q: "Can I share it with someone else?",
    a: "Yes. Publishing gives you a link that plays in any browser, on a phone or a shared machine. Whoever opens it doesn't sign up for anything, and the link keeps working after you make changes.",
  },
  {
    q: "What if the game gets the chemistry wrong?",
    a: "You're the check that matters, and you play it before anyone else does. Tell it what's wrong in plain words and it edits the simulation — and nothing publishes until it passes the validation gate again.",
  },
  {
    q: "How finished is this?",
    a: "Not very, and we'd rather say so. One game template today, a narrow slice of chemistry, and rough edges you will find. We're iterating in the open — the engine, the templates and the validation gate all move week to week. Try it, tell us where it falls short, and expect it to have changed by the time you come back.",
  },
  {
    q: "What does it cost?",
    a: "Nothing during the beta. We'd rather have people using it and telling us what breaks than a pricing page.",
  },
] as const;

export function Faq() {
  return (
    <section className="relative py-20 sm:py-28" id="faq">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] lg:gap-16">
          <SectionHeading
            className="lg:sticky lg:top-24"
            eyebrow="Questions"
            title="The things people ask first"
          />

          <ul className="flex flex-col">
            {FAQS.map((faq, i) => (
              <Reveal as="li" delay={i * 50} key={faq.q}>
                <details className="group border-border/80 border-b">
                  <summary className="text-foreground marker:content-none flex cursor-pointer list-none items-center gap-4 py-5 text-[15px] font-medium">
                    {faq.q}
                    <span
                      aria-hidden="true"
                      className="border-border text-muted-foreground group-hover:border-lp-violet/60 group-hover:text-lp-violet ml-auto flex size-7 shrink-0 items-center justify-center rounded-full border transition-all duration-200 group-open:rotate-45"
                    >
                      <PlusIcon className="size-3.5" />
                    </span>
                  </summary>
                  <p className="text-muted-foreground max-w-prose pb-5 text-sm leading-relaxed">
                    {faq.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
