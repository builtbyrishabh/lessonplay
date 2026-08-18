import type { ExperimentVisual } from "../model/experimentLab";

/**
 * How a recorded reading reads in a notebook cell, keyed by the stable visual.
 * `label` is the fallback text shown when an effect carries no structured
 * readout / gas token; `cls` is the meaning-carrying `gcell--*` styling hook.
 * This is the single source of truth for both the viewport render and the pure
 * {@link evidenceCellDisplay} formatter, so the "colour is never the only signal"
 * guarantee (every visual has a word) is enforced in one place.
 */
export const VISUAL_CELL: Record<ExperimentVisual, { label: string; cls: string }> = {
  beam: { label: "beam", cls: "gcell--beam" },
  settle: { label: "sinks", cls: "gcell--settle" },
  residue: { label: "residue", cls: "gcell--residue" },
  fizz: { label: "fizz", cls: "gcell--fizz" },
  "color-change": { label: "colour", cls: "gcell--colour" },
  gas: { label: "gas", cls: "gcell--gas" },
  precipitate: { label: "milky", cls: "gcell--ppt" },
  conductivity: { label: "bulb", cls: "gcell--conductivity" },
  temperature: { label: "temp", cls: "gcell--temperature" },
  "ph-scale": { label: "pH", cls: "gcell--ph" },
  odour: { label: "smell", cls: "gcell--odour" },
  measure: { label: "reading", cls: "gcell--measure" },
  none: { label: "clear", cls: "gcell--none" },
};

/** The glyph shown for an untested / empty notebook cell. */
export const EMPTY_CELL = "·";

/** The minimal shape the formatter needs from a recorded reading. */
export interface EvidenceReadingLike {
  readonly visual: ExperimentVisual;
  readonly gasLabel?: string;
  readonly readout?: { readonly value: string; readonly unit?: string };
}

export interface EvidenceCellDisplay {
  /** The text shown in the cell — always non-empty (never colour-only). */
  readonly value: string;
  /** The meaning-carrying `gcell--*` class, or `gcell--empty` for no reading. */
  readonly cls: string;
  /** True when there is no recorded reading yet. */
  readonly empty: boolean;
}

/**
 * Derive what a single notebook cell displays from its recorded reading.
 *
 * Precedence for the value mirrors "show the most specific real evidence":
 *  1. a structured readout value (`"red"`, `"pH 2"`, `"on"`) — the actual datum,
 *  2. else a gas token (`"H₂"`, `"CO₂"`),
 *  3. else the generic per-visual word (`"beam"`, `"fizz"`, `"milky"`),
 *  4. else the empty marker `"·"` (no reading recorded).
 *
 * Text is **always present**, so colour is never the only carrier of meaning and
 * a colour-blind learner can still read every cell. Passing `null`/`undefined`
 * yields the empty cell.
 */
export function evidenceCellDisplay(
  reading: EvidenceReadingLike | null | undefined,
): EvidenceCellDisplay {
  if (!reading) {
    return { value: EMPTY_CELL, cls: "gcell--empty", empty: true };
  }
  const cell = VISUAL_CELL[reading.visual];
  // A `measure` reading carries a number whose unit is part of the evidence a
  // learner reads off the balance ("50 g"), so keep the unit on the datum; every
  // other readout is already self-describing and shows its bare value.
  const readoutText = reading.readout
    ? reading.visual === "measure" && reading.readout.unit
      ? `${reading.readout.value} ${reading.readout.unit}`
      : reading.readout.value
    : undefined;
  const value = readoutText ?? reading.gasLabel ?? cell?.label ?? EMPTY_CELL;
  return { value, cls: cell?.cls ?? "gcell--empty", empty: false };
}
