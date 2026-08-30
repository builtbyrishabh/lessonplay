"use client";

import { useEffect, useRef, useState } from "react";

import { Reveal } from "~/components/marketing/reveal";
import { Container, SectionHeading } from "~/components/marketing/section";
import {
  CheckIcon,
  CodeIcon,
  EyeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SpinnerIcon,
} from "~/lib/icons";
import { cn } from "~/lib/utils";

/** The build, as the studio actually narrates it — read, plan, write, gate, ship. */
const STEPS = [
  { label: "Read the chapter section", detail: "12 activities found" },
  { label: "Plan the level ladder", detail: "5 levels · 3 unknowns" },
  { label: "Write the simulation rules", detail: "experiment.ts" },
  { label: "Play it through to a win", detail: "validation passed" },
  { label: "Publish a shareable link", detail: "v1 · current" },
] as const;

const STEP_MS = 900;

/** Advances the build log once the panel is on screen; stops at the end. */
function useBuildSequence(ref: React.RefObject<HTMLDivElement | null>) {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let interval: ReturnType<typeof setInterval> | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        if (reduced) {
          setStep(STEPS.length); // Finished state, no animation.
          return;
        }
        setStep(0);
        interval = setInterval(() => {
          setStep((s) => {
            if (s >= STEPS.length) {
              clearInterval(interval);
              return s;
            }
            return s + 1;
          });
        }, STEP_MS);
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (interval) clearInterval(interval);
    };
  }, [ref]);

  return step;
}

function TestTube({
  fill,
  level,
  bubbling,
  label,
}: {
  fill: string;
  level: number;
  bubbling?: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="border-foreground/15 bg-foreground/[0.03] relative h-24 w-9 overflow-hidden rounded-b-full rounded-t-sm border">
        <div
          className="absolute inset-x-0 bottom-0 rounded-b-full transition-all duration-700"
          style={{ height: `${level}%`, background: fill }}
        />
        {bubbling
          ? [0, 1, 2].map((i) => (
              <span
                className="lp-bubble absolute bottom-2 size-1.5 rounded-full bg-white/70"
                key={i}
                style={{
                  left: `${28 + i * 18}%`,
                  animationDelay: `${i * 0.7}s`,
                }}
              />
            ))
          : null}
        {/* Glass highlight — sells the material without a texture image. */}
        <span className="absolute top-2 left-1.5 h-12 w-1 rounded-full bg-white/25" />
      </div>
      <span className="text-muted-foreground font-mono text-[10px] tracking-wide">
        {label}
      </span>
    </div>
  );
}

/** A staged illustration of our own studio — chat and build log on the left,
 *  the running game on the right. Hand-drawn in DOM rather than screenshotted
 *  so it stays sharp, themeable and readable to a screen reader. */
export function StudioDemo() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const step = useBuildSequence(panelRef);
  const done = step >= STEPS.length;

  return (
    <section className="relative py-20 sm:py-28" id="studio">
      <Container>
        <SectionHeading
          align="center"
          className="items-center text-center"
          eyebrow="What actually happens"
          lead="You describe the lesson. The studio writes the simulation, plays it to a win to prove it works, and publishes it. You watch the whole thing happen."
          title="One sentence in. A playable lab out."
        />

        <Reveal className="mt-12" delay={80}>
          <div
            className="border-border bg-card relative overflow-hidden rounded-2xl border shadow-2xl"
            ref={panelRef}
          >
            {/* Window chrome */}
            <div className="border-border/70 bg-muted/40 flex items-center gap-2 border-b px-4 py-3">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-red-400/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
              </span>
              <span className="text-muted-foreground ml-2 truncate font-mono text-xs">
                lessonplay.app
                <span className="hidden sm:inline"> / separation-of-mixtures</span>
              </span>
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                  done
                    ? "bg-lp-lime/15 text-lp-lime"
                    : "bg-lp-violet/15 text-lp-violet",
                )}
              >
                {done ? (
                  <CheckIcon className="size-3" />
                ) : (
                  <SpinnerIcon className="size-3 animate-spin" />
                )}
                {done ? "Published" : "Building"}
              </span>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              {/* Left: the conversation and the build log. */}
              <div className="border-border/70 flex flex-col gap-4 p-5 lg:border-r sm:p-6">
                <div className="ml-auto max-w-[85%]">
                  <p className="bg-lp-brand text-lp-on-brand rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
                    Class 9 — separation of mixtures. Make them figure out which
                    method to use instead of memorising the list.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="bg-lp-violet/10 text-lp-violet mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                    <SparklesIcon className="size-3.5" />
                  </span>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Building a discovery lab: five mixtures, four tools, and no
                    hint about which tool fits. Here we go.
                  </p>
                </div>

                <ol className="border-border/70 bg-muted/30 mt-1 flex flex-col gap-0.5 rounded-xl border p-2">
                  {STEPS.map((s, i) => {
                    const state =
                      step > i ? "done" : step === i ? "active" : "pending";
                    return (
                      <li
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-300",
                          state === "pending" && "opacity-35",
                          state === "active" && "bg-background/70",
                        )}
                        key={s.label}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
                            state === "done"
                              ? "bg-lp-lime/15 text-lp-lime"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {state === "done" ? (
                            <CheckIcon className="size-3" />
                          ) : state === "active" ? (
                            <SpinnerIcon className="size-3 animate-spin" />
                          ) : (
                            <span className="bg-current size-1.5 rounded-full opacity-40" />
                          )}
                        </span>
                        <span className="text-foreground text-[13px] font-medium">
                          {s.label}
                        </span>
                        <span className="text-muted-foreground ml-auto truncate font-mono text-[11px]">
                          {state === "pending" ? "" : s.detail}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <div className="text-muted-foreground mt-auto flex items-center gap-4 pt-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5">
                    <EyeIcon className="size-3.5" /> Preview
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CodeIcon className="size-3.5" /> Code
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheckIcon className="size-3.5" /> Gate
                  </span>
                </div>
              </div>

              {/* Right: the game the build produces. */}
              <div className="bg-muted/25 relative p-5 sm:p-6">
                <div
                  className={cn(
                    "border-border bg-background relative flex h-full min-h-[22rem] flex-col overflow-hidden rounded-xl border shadow-sm transition-all duration-700",
                    done ? "opacity-100" : "opacity-70 blur-[1px]",
                  )}
                >
                  <div className="border-border/70 flex items-center justify-between border-b px-4 py-2.5">
                    <span className="text-foreground text-xs font-semibold">
                      Level 2 · Unknown mixture
                    </span>
                    <span className="flex gap-1" aria-hidden="true">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          className={cn(
                            "h-1.5 w-5 rounded-full",
                            i < 2 ? "bg-lp-lime" : "bg-muted",
                          )}
                          key={i}
                        />
                      ))}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
                    <p className="text-muted-foreground max-w-[15rem] text-center text-xs leading-relaxed">
                      Sand, salt and water are in the same beaker. Get the salt
                      out — dry, and without losing it.
                    </p>
                    <div className="flex items-end gap-5">
                      <TestTube
                        fill="linear-gradient(180deg, var(--lp-amber), color-mix(in oklch, var(--lp-amber), black 25%))"
                        label="A"
                        level={62}
                      />
                      <TestTube
                        bubbling
                        fill="linear-gradient(180deg, var(--lp-cyan), color-mix(in oklch, var(--lp-cyan), black 25%))"
                        label="B"
                        level={78}
                      />
                      <TestTube
                        fill="linear-gradient(180deg, var(--lp-violet), color-mix(in oklch, var(--lp-violet), black 25%))"
                        label="C"
                        level={45}
                      />
                    </div>
                  </div>

                  <div className="border-border/70 flex flex-wrap gap-1.5 border-t p-3">
                    {["Filter", "Evaporate", "Decant", "Distil"].map((tool, i) => (
                      <span
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-[11px] font-medium",
                          i === 1
                            ? "bg-lp-brand text-lp-on-brand"
                            : "bg-muted text-muted-foreground",
                        )}
                        key={tool}
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                {!done ? (
                  <span className="border-border bg-card/90 text-muted-foreground pointer-events-none absolute inset-0 m-auto flex h-7 w-fit items-center gap-1.5 rounded-full border px-3 text-[11px] shadow-sm backdrop-blur">
                    <SpinnerIcon className="size-3 animate-spin" />
                    Rendering preview…
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
