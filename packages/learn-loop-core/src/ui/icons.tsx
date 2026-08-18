import type { ReactElement, ReactNode, SVGProps } from "react";

/**
 * One consistent inline-SVG icon family for the ExperimentLab viewport, replacing
 * the emoji that used to render differently on every OS. Every glyph is drawn on a
 * 24×24 grid, uses `currentColor`, and shares one uniform stroke width so the set
 * reads as a single designed family. Size is token-driven (`--xl-icon-size` via
 * the `.xl-icon` class), never hard-coded here.
 *
 * Two id spaces resolve through the same registry:
 *  - **tool ids** — the stable ids the authoring model uses for bench tools
 *    (`light`, `filter`, `heat`, `acid`, `magnet`, …).
 *  - **semantic ids** — viewport chrome (`objective`, `hint`, `verdict-correct`,
 *    `verdict-wrong`, `complete`).
 * Unknown ids fall back to a safe generic "instrument" glyph, so a novel tool id
 * from a future game never renders a hole.
 */

export type IconGlyph = (props: SVGProps<SVGSVGElement>) => ReactElement;

/** Shared canvas + stroke defaults so every glyph is one visual family. */
function svg(children: ReactNode, props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ---- Semantic / chrome glyphs ---- */

const generic: IconGlyph = (p) =>
  // A stylised beaker/flask — the safe fallback "instrument" mark.
  svg(
    <>
      <path d="M9 3h6" />
      <path d="M10 3v6l-4.5 8a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9V3" />
      <path d="M7.5 15h9" />
    </>,
    p,
  );

const objective: IconGlyph = (p) =>
  // Target / crosshair — the goal marker.
  svg(
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 1.5V4M12 20v2.5M1.5 12H4M20 12h2.5" />
    </>,
    p,
  );

const hint: IconGlyph = (p) =>
  // Lightbulb — a hint.
  svg(
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.8 10.6c.5.4.8 1 .8 1.7V16h6v-.7c0-.7.3-1.3.8-1.7A6 6 0 0 0 12 3Z" />
    </>,
    p,
  );

const verdictCorrect: IconGlyph = (p) =>
  // Check in a ring — a correct prediction.
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </>,
    p,
  );

const verdictWrong: IconGlyph = (p) =>
  // Cross in a ring — a wrong prediction (shape, not just colour).
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>,
    p,
  );

const complete: IconGlyph = (p) =>
  // A torch/beam firing — the on-brand "case closed" finale mark.
  svg(
    <>
      <rect x="3.5" y="9" width="7" height="6" rx="1.5" />
      <path d="M10.5 10.5 20 7M10.5 13.5 20 17M20 10v4" />
    </>,
    p,
  );

/* ---- Tool glyphs ---- */

const light: IconGlyph = (p) =>
  // A lamp casting a beam — the side-light / Tyndall tool.
  svg(
    <>
      <rect x="3.5" y="9" width="6" height="6" rx="1.5" />
      <path d="M9.5 12h4M15 12h.01M17.5 12h.01M20 12h.01" />
    </>,
    p,
  );

const settle: IconGlyph = (p) =>
  // An hourglass — let it stand / settle.
  svg(
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3c0 4 4 5 5 9-1 4-5 5-5 9M17 3c0 4-4 5-5 9 1 4 5 5 5 9" />
    </>,
    p,
  );

const filter: IconGlyph = (p) =>
  // A funnel — filtering.
  svg(
    <>
      <path d="M3.5 5h17l-6.2 7.2V20l-4.6-2.4v-5.4Z" />
    </>,
    p,
  );

const heat: IconGlyph = (p) =>
  // A flame — heat / flame test.
  svg(
    <>
      <path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.6.7-2.6 1.5-3.5C10.5 8.5 12 6 12 3Z" />
      <path d="M12 14.5c1.2 0 2-.9 2-2 0-.9-.5-1.5-1-2.2-.6.8-1.4 1.3-1.4 2.4 0 1 .3 1.8.4 1.8Z" />
    </>,
    p,
  );

const stir: IconGlyph = (p) =>
  // A spoon / stirring rod.
  svg(
    <>
      <path d="M14.5 4.5a3 3 0 0 1 0 4.2l-1.4 1.4-2.8-2.8L11.7 6a3 3 0 0 1 2.8-1.5Z" />
      <path d="M10.3 9.3 4 15.6a2 2 0 0 0 2.8 2.8l6.3-6.3" />
    </>,
    p,
  );

const drop: IconGlyph = (p) =>
  // A droplet — acid / water dispensers.
  svg(
    <>
      <path d="M12 3c3 4 5 6.4 5 9.2A5 5 0 0 1 7 12.2C7 9.4 9 7 12 3Z" />
    </>,
    p,
  );

const base: IconGlyph = (p) =>
  // A dropper bottle — a base reagent.
  svg(
    <>
      <path d="M10 3h4v3h-4z" />
      <path d="M9 6h6l1 3v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V9Z" />
      <path d="M9.5 13h5" />
    </>,
    p,
  );

const litmus: IconGlyph = (p) =>
  // A test strip — litmus / indicator paper.
  svg(
    <>
      <rect x="8.5" y="3" width="7" height="18" rx="1.5" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h7" />
    </>,
    p,
  );

const magnet: IconGlyph = (p) =>
  // A horseshoe magnet.
  svg(
    <>
      <path d="M6 4v7a6 6 0 0 0 12 0V4" />
      <path d="M6 8h4M14 8h4" />
    </>,
    p,
  );

const limewater: IconGlyph = (p) =>
  // A glass of limewater.
  svg(
    <>
      <path d="M7 4h10l-1 15a2 2 0 0 1-2 1.8h-4A2 2 0 0 1 8 19Z" />
      <path d="M7.4 10h9.2" />
    </>,
    p,
  );

const evaporate: IconGlyph = (p) =>
  // A dish with rising vapour — evaporation.
  svg(
    <>
      <path d="M4 15h16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" />
      <path d="M9 4c-.8 1 .8 2 0 3M12 3c-.8 1 .8 2 0 3M15 4c-.8 1 .8 2 0 3" />
    </>,
    p,
  );

const dip: IconGlyph = (p) =>
  // A strip lowered into a beaker of solution — the binary "dip" combine tool.
  svg(
    <>
      <path d="M6 9h12l-1.2 9a2 2 0 0 1-2 1.7H9.2a2 2 0 0 1-2-1.7Z" />
      <path d="M6.6 13.5h10.8" />
      <path d="M12 2.5V13" />
    </>,
    p,
  );

const balance: IconGlyph = (p) =>
  // A two-pan balance — the `weigh`/`measure` instrument.
  svg(
    <>
      <path d="M12 3v16" />
      <path d="M6 20h12" />
      <path d="M4 7h16" />
      <path d="M4 7l-2.5 5a3 3 0 0 0 5 0Z" />
      <path d="M20 7l-2.5 5a3 3 0 0 0 5 0Z" />
    </>,
    p,
  );

/**
 * The id → glyph registry. Tool ids and semantic ids share this map. Kept in one
 * object so {@link getIconGlyph} and consumers never branch on id space.
 */
export const ICON_REGISTRY: Record<string, IconGlyph> = {
  // Semantic / chrome
  objective,
  hint,
  "verdict-correct": verdictCorrect,
  "verdict-wrong": verdictWrong,
  complete,
  generic,
  // Tools (mirror the previous TOOL_ICON emoji ids)
  light,
  settle,
  filter,
  heat,
  stir,
  acid: drop,
  base,
  litmus,
  water: drop,
  magnet,
  limewater,
  flame: heat,
  evaporate,
  dip,
  weigh: balance,
  balance,
  "add-solute": drop,
  react: stir,
};

/** The id used when a requested icon id is unknown. Always resolvable. */
export const FALLBACK_ICON_ID = "generic";

/**
 * Resolve an icon id to its glyph, falling back to the generic instrument glyph
 * for any unknown id. Never throws and never returns `undefined`.
 */
export function getIconGlyph(id: string): IconGlyph {
  return ICON_REGISTRY[id] ?? ICON_REGISTRY[FALLBACK_ICON_ID];
}

export interface IconProps {
  /** Tool id or semantic id. Unknown ids render the generic fallback glyph. */
  readonly id: string;
  /**
   * Accessible label. When provided, the icon is exposed to assistive tech with
   * this name (`role="img"`). Omit it (or pass `decorative`) when the icon sits
   * beside a visible text label, so it is `aria-hidden` and not double-announced.
   */
  readonly label?: string;
  /** Force the icon `aria-hidden` even if a label is given (purely decorative). */
  readonly decorative?: boolean;
  /** Extra class names appended after the base `xl-icon` token class. */
  readonly className?: string;
}

/**
 * The single icon primitive for the viewport. Sizing/stroke come from the shared
 * `.xl-icon` class (token-driven), the colour is inherited (`currentColor`), and
 * accessibility is explicit: labelled → `role="img"` with a `<title>`; otherwise
 * `aria-hidden`. Unknown ids degrade to the generic glyph rather than crashing.
 */
export function Icon({ id, label, decorative, className }: IconProps): ReactElement {
  const Glyph = getIconGlyph(id);
  const cls = className ? `xl-icon ${className}` : "xl-icon";
  const accessible = !decorative && label != null && label.length > 0;
  return (
    <Glyph
      className={cls}
      role={accessible ? "img" : undefined}
      aria-label={accessible ? label : undefined}
      aria-hidden={accessible ? undefined : true}
      focusable="false"
    />
  );
}
