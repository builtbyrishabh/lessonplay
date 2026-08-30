import { Reveal } from "~/components/marketing/reveal";
import { cn } from "~/lib/utils";

/** One page-width container. Every section shares it so edges line up. */
export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

/** The small uppercase label that opens each section. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-lp-violet inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase",
        className,
      )}
    >
      <span aria-hidden="true" className="bg-lp-violet/50 h-px w-6" />
      {children}
    </span>
  );
}

/**
 * Section heading block: eyebrow, title, and an optional lead paragraph. Kept
 * in one component so the vertical rhythm between the three is identical on
 * every section instead of re-guessed each time.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-foreground max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {lead ? (
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
          {lead}
        </p>
      ) : null}
    </Reveal>
  );
}
