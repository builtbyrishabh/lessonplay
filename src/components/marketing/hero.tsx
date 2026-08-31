"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Reveal } from "~/components/marketing/reveal";
import { Container } from "~/components/marketing/section";
import { ArrowUpIcon, SparklesIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";

/** Cycled through the empty composer so the box shows its own range. */
const TYPED_EXAMPLES = [
  "Paste the “Is Matter Around Us Pure?” chapter section…",
  "A lab where students identify three unknown salts…",
  "Turn Activity 2.4 on filtration into something playable…",
  "Teach the reactivity series without me lecturing…",
];

/** One tap fills the box — the fastest way to see what a good prompt looks like. */
const STARTERS = [
  "Separation of mixtures",
  "Identify the unknown acid",
  "Reactivity series",
  "Acids, bases and pH",
];

const TYPE_MS = 42;
const ERASE_MS = 18;
const HOLD_MS = 2200;

function useTypedPlaceholder(active: boolean) {
  const [text, setText] = useState("");
  const state = useRef({ line: 0, char: 0, erasing: false });

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(TYPED_EXAMPLES[0]!);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const s = state.current;
      const line = TYPED_EXAMPLES[s.line % TYPED_EXAMPLES.length]!;

      if (!s.erasing) {
        s.char += 1;
        setText(line.slice(0, s.char));
        if (s.char >= line.length) {
          s.erasing = true;
          timer = setTimeout(tick, HOLD_MS);
          return;
        }
        timer = setTimeout(tick, TYPE_MS);
        return;
      }

      s.char -= 1;
      setText(line.slice(0, Math.max(0, s.char)));
      if (s.char <= 0) {
        s.erasing = false;
        s.line += 1;
      }
      timer = setTimeout(tick, ERASE_MS);
    };

    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [active]);

  return text;
}

/** Loose lattice of bonded atoms — brand texture, not information. */
function MoleculeGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="currentColor" strokeWidth="1.5">
        <path d="M100 34 L156 66 M156 66 L156 130 M156 130 L100 162 M100 162 L44 130 M44 130 L44 66 M44 66 L100 34 M100 34 L100 98 M100 98 L156 130 M100 98 L44 130" />
      </g>
      <g fill="currentColor">
        <circle cx="100" cy="34" r="7" />
        <circle cx="156" cy="66" r="5" />
        <circle cx="156" cy="130" r="5" />
        <circle cx="100" cy="162" r="7" />
        <circle cx="44" cy="130" r="5" />
        <circle cx="44" cy="66" r="5" />
        <circle cx="100" cy="98" r="9" />
      </g>
    </svg>
  );
}

export function Hero() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const typed = useTypedPlaceholder(!focused && value.length === 0);

  const submit = (raw: string) => {
    const text = raw.trim();
    // The studio is behind auth; carry the prompt through the sign-up hop so
    // the composer is already filled in on the other side.
    const target = text ? `/chats?q=${encodeURIComponent(text)}` : "/chats";
    router.push(
      isSignedIn
        ? target
        : `/sign-up?redirect_url=${encodeURIComponent(target)}`,
    );
  };

  return (
    <section className="relative isolate overflow-hidden">
      {/* Ground: graph paper, two reagent glows, one drifting lattice. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="lp-grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_75%)]" />
        <div
          className="absolute -top-40 left-1/2 h-[38rem] w-[38rem] -translate-x-[70%] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--lp-glow-a), transparent 65%)" }}
        />
        <div
          className="absolute -top-24 left-1/2 h-[34rem] w-[34rem] -translate-x-[10%] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--lp-glow-b), transparent 65%)" }}
        />
        <MoleculeGlyph className="lp-float text-lp-violet/15 absolute top-28 right-[6%] hidden size-56 lg:block" />
        <MoleculeGlyph
          className="lp-float text-lp-cyan/15 absolute bottom-10 left-[4%] hidden size-36 lg:block"
          // Offset so the two never bob in lockstep.
        />
      </div>

      <Container className="pt-14 pb-20 sm:pt-20 sm:pb-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal>
            <span className="border-border/80 bg-card/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
              <span className="bg-lp-lime relative flex size-1.5 rounded-full">
                <span className="bg-lp-lime absolute inline-flex size-full animate-ping rounded-full opacity-60" />
              </span>
              Free beta — chemistry, classes 8–10
            </span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="text-foreground mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Your chemistry chapter,{" "}
              <span className="relative whitespace-nowrap">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(100deg, var(--lp-violet), var(--lp-cyan))",
                  }}
                >
                  as a game
                </span>
                <svg
                  aria-hidden="true"
                  className="text-lp-violet/40 absolute -bottom-1 left-0 h-2.5 w-full"
                  fill="none"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 8"
                >
                  <path
                    d="M1 6C22 2.5 46 1.8 99 4.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2.5"
                  />
                </svg>
              </span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="text-muted-foreground mt-6 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
              Describe a lesson — or paste the chapter straight in. LessonPlay
              builds a real, playable lab simulation you can reason your way
              through, then hands you one link to keep or pass on.
            </p>
          </Reveal>

          {/* The composer is the hero. Everything above it exists to get a
              someone to type one sentence here. */}
          <Reveal className="mt-9 w-full" delay={180}>
            <form
              className={cn(
                "border-border bg-card/90 relative rounded-2xl border p-2 text-left shadow-xl backdrop-blur-sm transition-all duration-200",
                focused
                  ? "border-lp-violet/60 shadow-lp-violet/10 shadow-2xl"
                  : "hover:border-border/60",
              )}
              onSubmit={(e) => {
                e.preventDefault();
                submit(value);
              }}
            >
              <label className="sr-only" htmlFor="hero-prompt">
                Describe the lesson you want to turn into a game
              </label>
              <textarea
                className="text-foreground placeholder:text-muted-foreground/0 min-h-[76px] w-full resize-none bg-transparent px-3 pt-3 text-base leading-relaxed outline-none"
                id="hero-prompt"
                onBlur={() => setFocused(false)}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(value);
                  }
                }}
                ref={inputRef}
                rows={2}
                value={value}
              />
              {/* Animated stand-in for the placeholder, so the caret can blink
                  without the browser's own placeholder fighting it. */}
              {!focused && value.length === 0 ? (
                <span
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute top-3 left-3 max-w-[calc(100%-1.5rem)] truncate text-base leading-relaxed"
                >
                  {typed}
                  <span className="lp-caret text-lp-violet ml-0.5">|</span>
                </span>
              ) : null}

              <div className="flex items-center justify-between gap-3 px-1 pt-1 pb-1">
                <span className="text-muted-foreground hidden items-center gap-1.5 pl-2 text-xs sm:flex">
                  <SparklesIcon className="text-lp-violet size-3.5" />
                  Chapter text, an activity, or one concept
                </span>
                <button
                  className="bg-lp-brand text-lp-on-brand ml-auto inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-all hover:brightness-110 focus-visible:ring-3 focus-visible:ring-[var(--lp-brand)]/40 focus-visible:outline-none active:scale-[0.98]"
                  type="submit"
                >
                  Build my game
                  <ArrowUpIcon className="size-4" />
                </button>
              </div>
            </form>
          </Reveal>

          <Reveal className="mt-5 w-full" delay={240}>
            <ul className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    className="border-border/80 bg-card/60 text-muted-foreground hover:border-lp-violet/50 hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
                    onClick={() => {
                      setValue(starter);
                      inputRef.current?.focus();
                    }}
                    type="button"
                  >
                    {starter}
                  </button>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal className="mt-8" delay={300}>
            <p className="text-muted-foreground/80 text-xs">
              Free while in beta · Nothing to install · Runs in any browser
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
