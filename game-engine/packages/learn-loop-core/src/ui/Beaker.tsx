import type { CSSProperties } from "react";
import type {
  ExperimentReadout,
  ExperimentVisual,
} from "../model/experimentLab";

const COLOUR_TOKENS = [
  {
    words: ["colourless", "colorless", "clear", "transparent"],
    top: "rgba(88, 180, 232, 0.22)",
    bottom: "rgba(37, 99, 135, 0.16)",
    glow: "rgba(120, 205, 255, 0.2)",
  },
  {
    words: ["pink"],
    top: "#ff8acb",
    bottom: "#b83280",
    glow: "rgba(255, 138, 203, 0.45)",
  },
  {
    words: ["purple", "violet"],
    top: "#d56bd0",
    bottom: "#8e2f9a",
    glow: "rgba(213, 107, 208, 0.4)",
  },
  {
    words: ["blue"],
    top: "#5ca9ff",
    bottom: "#174ea6",
    glow: "rgba(92, 169, 255, 0.45)",
  },
  {
    words: ["red"],
    top: "#ff6b6b",
    bottom: "#a71930",
    glow: "rgba(255, 107, 107, 0.45)",
  },
  {
    words: ["green"],
    top: "#68d391",
    bottom: "#18794e",
    glow: "rgba(104, 211, 145, 0.42)",
  },
  {
    words: ["yellow"],
    top: "#ffe066",
    bottom: "#b7791f",
    glow: "rgba(255, 224, 102, 0.42)",
  },
  {
    words: ["orange"],
    top: "#ffad66",
    bottom: "#c45100",
    glow: "rgba(255, 173, 102, 0.42)",
  },
  {
    words: ["white"],
    top: "#f4f7fb",
    bottom: "#cbd5e1",
    glow: "rgba(244, 247, 251, 0.42)",
  },
  {
    words: ["black", "dark"],
    top: "#4b5563",
    bottom: "#111827",
    glow: "rgba(75, 85, 99, 0.4)",
  },
] as const;

function colourReadoutStyle(
  readout: ExperimentReadout | undefined,
): CSSProperties | undefined {
  if (readout?.kind !== "color") return undefined;

  const value = readout.value.trim().toLowerCase();
  const tokens = COLOUR_TOKENS.find(({ words }) =>
    words.some((word) => value.includes(word)),
  );
  if (!tokens) return undefined;

  return {
    "--xl-colour-top": tokens.top,
    "--xl-colour-bottom": tokens.bottom,
    "--xl-colour-glow": tokens.glow,
  } as CSSProperties;
}

/**
 * The hero of an ExperimentLab game: a glowing beaker in a dark lab. The Tyndall
 * light beam is the money shot — a bright shaft that blazes across a cloudy
 * liquid and passes invisibly through a clear one. `settle` and `residue` are
 * the supporting effects. The component is purely presentational: it renders the
 * `visual` it is handed by {@link ExperimentLabViewport}, which is driven by the
 * tested session reducer.
 */
export function Beaker({
  visual,
  cloudy,
  animating = false,
  gasLabel,
  readout,
  showLamp = false,
}: {
  readonly visual: ExperimentVisual;
  /** Hint for the resting liquid look; the beam is what actually teaches. */
  readonly cloudy: boolean;
  /** True while the effect is playing out, for a brighter live look. */
  readonly animating?: boolean;
  /** Short gas token chipped onto the escaping bubbles, e.g. "H₂". */
  readonly gasLabel?: string;
  /**
   * Structured evidence for the active effect. A colour readout tints a
   * `color-change`; a measure readout fills the balance plate.
   */
  readonly readout?: ExperimentReadout;
  /**
   * Draw the side lamp that fires the Tyndall beam. Only meaningful for games
   * that actually use the `beam` visual; games that never scatter light (e.g. an
   * acid/base bench) would otherwise show a stray dark box beside the glass.
   */
  readonly showLamp?: boolean;
}) {
  const beam = visual === "beam";
  const settle = visual === "settle";
  const residue = visual === "residue";
  const fizz = visual === "fizz";
  const colorChange = visual === "color-change";
  const gas = visual === "gas";
  const precipitate = visual === "precipitate";
  const measure = visual === "measure";

  return (
    <div
      className={`beaker ${beam ? "is-beam" : ""} ${animating ? "is-animating" : ""}`}
    >
      <div className="beaker__glass">
        <div
          className={`beaker__liquid ${cloudy || beam ? "is-cloudy" : ""} ${
            colorChange ? "is-colour" : ""
          } ${precipitate ? "is-milky" : ""}`}
          style={colorChange ? colourReadoutStyle(readout) : undefined}
        >
          {/* drifting motes — the suspended particles light scatters off */}
          {(cloudy || beam) && (
            <div className="motes" aria-hidden>
              {MOTES.map((m) => (
                <span
                  key={m.id}
                  className="mote"
                  style={{
                    left: `${m.x}%`,
                    top: `${m.y}%`,
                    animationDelay: `${m.delay}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* the Tyndall beam */}
          {beam && (
            <div className="beam" aria-hidden>
              <div className="beam__shaft" />
              <div className="beam__glow" />
            </div>
          )}

          {/* sediment layer that has settled out */}
          {settle && <div className="sediment" aria-hidden />}

          {/* filter residue clinging to the inner wall */}
          {residue && <div className="residue" aria-hidden />}

          {/* rising bubbles — effervescence (fizz) and gas escaping (gas) */}
          {(fizz || gas) && (
            <div className={`bubbles ${gas ? "bubbles--gas" : ""}`} aria-hidden>
              {BUBBLES.map((b) => (
                <span
                  key={b.id}
                  className="bubble"
                  style={{
                    left: `${b.x}%`,
                    width: `${b.size}px`,
                    height: `${b.size}px`,
                    animationDelay: `${b.delay}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* curd flecks suspended through the milky liquid */}
          {precipitate && (
            <div className="precipitate" aria-hidden>
              {MOTES.map((m) => (
                <span
                  key={m.id}
                  className="curd"
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                />
              ))}
            </div>
          )}

          <div className="beaker__surface" aria-hidden />
        </div>
      </div>

      {/* balance plate: the number a `measure` reads off (mass, volume, …). Real
          text, not aria-hidden, so the reading is announced like the gas chip. */}
      {measure && (
        <div className="readout-plate">
          <span className="readout-plate__value">{readout?.value ?? "—"}</span>
          {readout?.unit && (
            <span className="readout-plate__unit">{readout.unit}</span>
          )}
        </div>
      )}

      {/* gas identity chip riding above the escaping bubbles */}
      {gas && gasLabel && <div className="gas-chip">{gasLabel} ↑</div>}

      {/* the lamp that fires the beam, drawn outside the glass — only for games
          that use the Tyndall beam at all */}
      {showLamp && (
        <div className={`lamp ${beam ? "is-on" : ""}`} aria-hidden>
          <div className="lamp__bulb" />
        </div>
      )}
    </div>
  );
}

interface Mote {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly delay: number;
}

// Deterministic scatter so the look is stable across renders.
const MOTES: readonly Mote[] = [
  { id: 0, x: 18, y: 28, delay: 0 },
  { id: 1, x: 62, y: 20, delay: 0.6 },
  { id: 2, x: 40, y: 48, delay: 1.1 },
  { id: 3, x: 78, y: 56, delay: 0.3 },
  { id: 4, x: 26, y: 64, delay: 1.4 },
  { id: 5, x: 54, y: 72, delay: 0.9 },
  { id: 6, x: 70, y: 38, delay: 1.7 },
  { id: 7, x: 34, y: 36, delay: 2.0 },
  { id: 8, x: 48, y: 60, delay: 0.5 },
];

interface Bubble {
  readonly id: number;
  readonly x: number;
  readonly size: number;
  readonly delay: number;
}

// Deterministic bubble column for fizz / gas effervescence.
const BUBBLES: readonly Bubble[] = [
  { id: 0, x: 30, size: 7, delay: 0 },
  { id: 1, x: 52, size: 5, delay: 0.25 },
  { id: 2, x: 44, size: 9, delay: 0.5 },
  { id: 3, x: 62, size: 6, delay: 0.15 },
  { id: 4, x: 38, size: 4, delay: 0.7 },
  { id: 5, x: 56, size: 8, delay: 0.9 },
  { id: 6, x: 48, size: 5, delay: 0.4 },
  { id: 7, x: 34, size: 6, delay: 1.1 },
];
