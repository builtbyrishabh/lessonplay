"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";

/**
 * Settles its children into place the first time they scroll into view.
 *
 * The displaced starting state lives in CSS (`.lp-reveal`), which the
 * reduced-motion media query neutralises — so a visitor who asked for less
 * motion, or whose JS hasn't run yet, sees the finished layout, never a blank
 * section. `once` is the point: nothing re-animates on scroll-back.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger, in ms — 60–90 per sibling reads as a sequence, not a queue. */
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || shown) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <Tag
      className={cn("lp-reveal", className)}
      data-shown={shown}
      ref={ref as never}
      style={{ "--lp-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
