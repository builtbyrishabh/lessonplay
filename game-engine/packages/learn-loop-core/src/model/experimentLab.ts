/**
 * ExperimentLab model — the value types for the cause → effect experiment loop.
 *
 * Where the SandboxLab model authors a fixed outcome per `material × tool`
 * (a guided slideshow of pre-written reveals), ExperimentLab models a tiny
 * *consistent simulation*: every sample carries hidden ground-truth
 * `properties`, every tool is an operator, and a first-match-wins
 * {@link ExperimentRuleSet} computes the visible {@link ExperimentEffect} from
 * those properties. Because outcomes are derived from state (never hand-written
 * per pair), the same cause always yields the same effect, so a learner can
 * probe freely and build a real mental model — the heart of the
 * Predict → Act → Observe → Reconcile loop.
 *
 * This module is React-free value types only; the deterministic engine that
 * consumes them lives in `engine/experimentRules.ts`.
 */

/**
 * A single hidden property reading. Usually a category token
 * (`particleSize: "fine"`), but may be a **number** to model an amount, a mass,
 * a volume, or a pH value (`dissolved: 30`, `mass: 50`, `ph: 2`). Numeric values
 * unlock threshold/range rules and accumulation; string values behave exactly as
 * before.
 */
export type ExperimentPropertyValue = string | number;

/**
 * A numeric constraint on one property, used by a rule's `numericWhen` (and the
 * numeric reach-target). Two shapes, discriminated by the presence of `op`:
 *
 *   - **threshold** — `{ op: ">=", value: 7 }` compares the property to a literal,
 *     or `{ op: ">=", property: "saturationPoint" }` to another property of the
 *     *same* sample, so a hidden per-sample capacity drives the outcome
 *     ("dissolved ≥ saturationPoint") and the world stays rule-derived.
 *   - **range** — `{ min: 6, max: 8 }` (inclusive bounds; either may be omitted).
 *
 * Fail-closed: a comparison against a property the sample lacks, or a non-numeric
 * property, does not match — the same behaviour as a mismatched string in `when`.
 */
export interface NumericThreshold {
  readonly op: ">=" | "<=" | ">" | "<" | "==";
  /** Literal right-hand side. Exactly one of `value` / `property` is set. */
  readonly value?: number;
  /** Another property of the same sample used as the right-hand side. */
  readonly property?: string;
}

export interface NumericRange {
  readonly min?: number;
  readonly max?: number;
}

export type NumericComparison = NumericThreshold | NumericRange;

/** True for the threshold shape (has an `op`); false for the range shape. */
export function isNumericThreshold(
  cmp: NumericComparison,
): cmp is NumericThreshold {
  return "op" in cmp;
}

/**
 * The current property readings of one sample during play. Starts as the
 * sample's hidden `properties` and may evolve as effects apply `setState`
 * (e.g. a suspension becomes `settled` after standing), so later causes can
 * depend on earlier ones.
 */
export type ExperimentSampleState = Readonly<
  Record<string, ExperimentPropertyValue>
>;

/** A mystery sample on the bench. Its `properties` drive every outcome. */
export interface ExperimentSample {
  readonly id: string;
  /** Public, learner-facing label such as `"Unknown A"`. Never the answer. */
  readonly label: string;
  /** Hidden ground-truth the simulation reasons over. Not shown to the player. */
  readonly properties: ExperimentSampleState;
  /** Internal classification id used for grading, e.g. `"colloid"`. */
  readonly categoryId: ExperimentCategory["id"];
  /** Optional real-world identity for the reveal, e.g. `"diluted milk"`. */
  readonly revealLabel?: string;
}

/**
 * Whether a tool needs a **second operand** to act, and where it comes from:
 *
 *   - `{ kind: "sample" }`  — combine the primary sample with another sample on
 *     the bench (e.g. mix two solutions → precipitate).
 *   - `{ kind: "reagent" }` — add a named reagent from the shared shelf
 *     (e.g. add dilute HCl, drop iron into copper-sulfate).
 *
 * Absent ⇒ the tool is unary and behaves exactly as today.
 */
export type ExperimentOperandSpec =
  | { readonly kind: "sample" }
  | { readonly kind: "reagent" };

/** A tool the learner can apply to any sample (an operator over state). */
export interface ExperimentTool {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  /**
   * When set, the tool is **binary**: it acts on the primary sample *plus* a
   * second operand (another sample or a shelf reagent). Rules for a binary tool
   * may constrain the operand's state via `whenOperand` / `numericWhenOperand`.
   */
  readonly operand?: ExperimentOperandSpec;
}

/**
 * A named reagent on the shared shelf — the second operand for a `reagent`-kind
 * binary tool. Like a sample, it carries hidden `properties` the rules reason
 * over, so "dilute HCl" or "copper sulfate solution" behaves consistently. It is
 * never classified, so it needs no `categoryId`.
 */
export interface ExperimentReagent {
  readonly id: string;
  /** Public, learner-facing label such as `"Copper sulfate solution"`. */
  readonly label: string;
  /** Hidden ground-truth the simulation reasons over for combinations. */
  readonly properties: ExperimentSampleState;
}

/** The catalog of visible reactions the viewport can animate for a cause. */
export const EXPERIMENT_VISUALS = [
  "beam",
  "settle",
  "residue",
  "fizz",
  "color-change",
  "gas",
  "precipitate",
  // Added for chapter-activity coverage (e.g. Class 10 Acids, Bases and Salts):
  "conductivity", // a bulb/LED in the test circuit glows or stays dark
  "temperature", // the mixture warms or cools (thermometer moves)
  "ph-scale", // a strip/indicator lands on a spot of the 0–14 colour scale
  "odour", // a distinct smell is released (shown as a scent cue)
  // Added for the numeric primitive: a balance / graduated scale surfaces a
  // number to the learner (mass, volume, a pH value). Pairs with a "measure"
  // readout that carries the reading.
  "measure",
  "none",
] as const;

export type ExperimentVisual = (typeof EXPERIMENT_VISUALS)[number];

/**
 * The kinds of structured, quantitative-ish reading a cause can produce. A
 * readout turns "what is seen" into first-class *data* — the specific colour, a
 * point on the pH scale, whether the bulb lit — so the analyzer can treat two
 * otherwise same-visual outcomes as distinct evidence (see
 * `engine/experimentSignature.ts`). Each maps to the visual that renders it.
 */
export const EXPERIMENT_READOUT_KINDS = [
  "color", // e.g. "red", "blue", "pink", "colourless" — pairs with color-change
  "ph-scale", // e.g. "2", "7", "12" on the 0–14 scale — pairs with ph-scale
  "conductivity", // "on" | "off" (bulb glows / stays dark) — pairs with conductivity
  "temperature", // "hot" | "warm" | "cold" — pairs with temperature
  "odour", // e.g. "pungent", "none" — pairs with odour
  "measure", // a number the learner reads off, e.g. "80" (with an optional unit) — pairs with measure
] as const;

export type ExperimentReadoutKind = (typeof EXPERIMENT_READOUT_KINDS)[number];

/**
 * A structured reading attached to an effect, e.g. `{ kind: "color", value:
 * "red" }` or `{ kind: "ph-scale", value: "2" }`. `value` is the discriminating
 * datum a learner records; unlike free-text `observation`, it feeds the
 * distinguishability signature, so a difference in `value` alone (red vs blue
 * litmus, bulb on vs off) counts as evidence.
 */
export interface ExperimentReadout {
  readonly kind: ExperimentReadoutKind;
  readonly value: string;
  /**
   * Optional unit shown after a `measure` value (e.g. `"g"`, `"mL"`). Cosmetic;
   * it does not affect the distinguishability signature (the `value` does).
   */
  readonly unit?: string;
}

/**
 * What the learner observes from one cause. The `observation` text is strictly
 * *what is seen*, never the inference — the player draws the conclusion.
 */
export interface ExperimentEffect {
  /** Stable id so a notebook or analyzer can dedupe identical observations. */
  readonly observationId: string;
  /** Neutral, sensory description of the visible result. No inference. */
  readonly observation: string;
  readonly visual: ExperimentVisual;
  /**
   * Short gas token shown as a chip on the escaping bubbles, e.g. `"H₂"` /
   * `"CO₂"` / `"O₂"`. Only meaningful when `visual === "gas"`; ignored otherwise.
   * Like {@link ExperimentReadout}, it is discriminating evidence and feeds the
   * signature (H₂ from a metal vs CO₂ from a carbonate are different clues).
   */
  readonly gasLabel?: string;
  /**
   * Optional structured reading (colour, pH value, bulb state, temperature,
   * odour). First-class evidence: two effects that share a `visual` but differ
   * in their readout `value` are distinguishable to the analyzer.
   */
  readonly readout?: ExperimentReadout;
  /**
   * Optional persistent state change merged into the sample after this effect,
   * letting later causes depend on earlier ones (e.g. mark a sample settled).
   * `setState` *replaces* the named properties (absolute set).
   */
  readonly setState?: ExperimentSampleState;
  /**
   * Optional numeric *accumulation* merged after `setState`: each named property
   * has the delta **added** to its current value (a missing base is treated as
   * 0). This is how an amount grows across probes — e.g. `addState:
   * { dissolved: 10 }` each time a spoon of solute is added, until a saturation
   * threshold rule stops it.
   */
  readonly addState?: Readonly<Record<string, number>>;
  /**
   * For a binary effect, an optional persistent change applied to the **second
   * operand** (the other sample or reagent), mirroring `setState` on the primary.
   */
  readonly setOperandState?: ExperimentSampleState;
  /** For a binary effect, numeric accumulation on the second operand (see `addState`). */
  readonly addOperandState?: Readonly<Record<string, number>>;
}

/**
 * One declarative cause → effect rule. The rule fires when its `toolId` is
 * applied to a sample whose current state satisfies every entry in `when`.
 */
export interface ExperimentRule {
  readonly toolId: string;
  /**
   * String-equality property constraints that must all match the primary
   * sample's current state.
   */
  readonly when: ExperimentSampleState;
  /**
   * Optional numeric constraints on the primary sample's state (thresholds /
   * ranges), evaluated in addition to `when`. All entries must hold for the rule
   * to fire. This is what makes saturation and numeric pH first-class.
   */
  readonly numericWhen?: Readonly<Record<string, NumericComparison>>;
  /**
   * For a **binary** tool, string-equality constraints the second operand's
   * state must satisfy, so the same tool can produce different outcomes by what
   * it is combined with (e.g. iron behaves one way with copper sulfate, another
   * with plain water).
   */
  readonly whenOperand?: ExperimentSampleState;
  /** For a binary tool, numeric constraints on the second operand's state. */
  readonly numericWhenOperand?: Readonly<Record<string, NumericComparison>>;
  readonly effect: ExperimentEffect;
}

/**
 * The full physics of an experiment: an ordered, first-match-wins rule list
 * plus the consistent fallback used when a tool matches no rule for a sample.
 */
export interface ExperimentRuleSet {
  readonly rules: readonly ExperimentRule[];
  /** Consistent effect for any tool/state combination no rule covers. */
  readonly defaultEffect: ExperimentEffect;
}

/** An aggregate experiment: the bench, the tools, and the physics. */
export interface ExperimentDefinition {
  readonly samples: readonly ExperimentSample[];
  readonly tools: readonly ExperimentTool[];
  readonly ruleSet: ExperimentRuleSet;
  /**
   * The shared shelf of named reagents that `reagent`-kind binary tools draw
   * their second operand from. Optional; absent ⇒ no reagent combinations.
   */
  readonly reagents?: readonly ExperimentReagent[];
}

/**
 * A classification bucket the learner sorts samples into. The `label` is the
 * concept name (e.g. "Colloid") and is withheld from the bench, surfacing only
 * in the reveal — the "discovery before naming" principle. `definition` is the
 * one-line explanation shown last, as a reward rather than a lecture.
 */
export interface ExperimentCategory {
  readonly id: string;
  readonly label: string;
  readonly definition?: string;
}

/**
 * How much help a level offers. Difficulty climbs by *removing* scaffolding and
 * introducing the trap, never by adding clutter:
 *
 *   - `guided`  — tutorial: teaches one cause/tool; may be intentionally railed.
 *   - `hinted`  — full toolset, hints available on request.
 *   - `open`    — no hints; the designed ambiguity (the trap) is in play.
 */
export type ExperimentScaffolding = "guided" | "hinted" | "open";

export const EXPERIMENT_SCAFFOLDING = [
  "guided",
  "hinted",
  "open",
] as const;

/** One graduated hint, revealed in order only when the learner asks. */
export interface ExperimentHint {
  readonly id: string;
  readonly text: string;
}

/** The three shapes a level's win condition can take. */
export type ExperimentGoalKind =
  | "classify"
  | "predict-outcome"
  | "reach-target-state";

/**
 * The original, default goal: assign each sample in `classifyIds` to one of
 * `categoryIds`. The control/reference samples on the bench are deliberately
 * excluded from `classifyIds` so they aid reasoning without being graded.
 *
 * `kind` is optional and defaults to `"classify"` so existing data that predates
 * the discriminated union keeps validating and playing unchanged.
 */
export interface ClassifyGoal {
  readonly kind?: "classify";
  readonly classifyIds: readonly string[];
  readonly categoryIds: readonly string[];
}

/**
 * One predict-then-apply beat: the learner calls this `toolId`'s visible result
 * on this `sampleId` *before* the tool is run.
 */
export interface ExperimentPrompt {
  readonly sampleId: string;
  readonly toolId: string;
  /**
   * For a binary tool, the second operand to combine with — another sample id or
   * a shelf reagent id. The prediction then covers the *combination* (predict
   * what A + B will do before combining them).
   */
  readonly operandId?: string;
}

/**
 * Predict-outcome goal: the learner is walked through an ordered list of
 * `prompts`, predicting each tool's visible result before it is applied, and is
 * graded on how many predictions were right. The prediction is bound to the
 * action rather than posed as a detached quiz. Suited to genuine transformation
 * activities where the reaction — not the sample's identity — is the lesson.
 */
export interface PredictOutcomeGoal {
  readonly kind: "predict-outcome";
  readonly prompts: readonly ExperimentPrompt[];
}

/**
 * Reach-target-state goal: the learner must drive `sampleId` to a state that
 * satisfies every entry in `target` (e.g. `{ nature: "neutral" }`) by applying
 * tools whose effects carry `setState`. `targetLabel` names the goal for the
 * learner ("Make it neutral") without leaking the mechanism. Models an activity
 * as an outcome to achieve, not merely to observe (e.g. neutralisation).
 */
export interface ReachTargetStateGoal {
  readonly kind: "reach-target-state";
  readonly sampleId: string;
  readonly target: ExperimentSampleState;
  /**
   * Optional numeric win condition (thresholds/ranges) checked alongside the
   * string `target` — both must hold. Models a quantitative goal such as "drive
   * pH to 7" (`{ ph: { op: "==", value: 7 } }`) or "conserve total mass".
   */
  readonly numericTarget?: Readonly<Record<string, NumericComparison>>;
  readonly targetLabel: string;
}

/**
 * What a level asks the learner to do — a discriminated union over
 * {@link ExperimentGoalKind}. Absent `kind` is treated as `classify`.
 */
export type ExperimentGoal =
  | ClassifyGoal
  | PredictOutcomeGoal
  | ReachTargetStateGoal;

/** The kind of a goal, treating an absent discriminant as `"classify"`. */
export function experimentGoalKind(goal: ExperimentGoal): ExperimentGoalKind {
  return goal.kind ?? "classify";
}

/** Narrow a goal to the classic classify variant (the default when `kind` is absent). */
export function isClassifyGoal(goal: ExperimentGoal): goal is ClassifyGoal {
  return experimentGoalKind(goal) === "classify";
}

/** Narrow a goal to the predict-outcome variant. */
export function isPredictOutcomeGoal(
  goal: ExperimentGoal,
): goal is PredictOutcomeGoal {
  return goal.kind === "predict-outcome";
}

/** Narrow a goal to the reach-target-state variant. */
export function isReachTargetStateGoal(
  goal: ExperimentGoal,
): goal is ReachTargetStateGoal {
  return goal.kind === "reach-target-state";
}

/**
 * One playable level: which subset of the bench is present, the goal, the
 * scaffolding, whether prediction is required, the framing copy, and the
 * ordered hints. Levels share one {@link ExperimentDefinition} (one consistent
 * world) and differ only in what they expose and ask.
 */
export interface ExperimentLevel {
  readonly id: string;
  readonly title: string;
  /** Framing shown before play: the situation and what to do. */
  readonly intro: string;
  /** Shown after a correct classification, before the reveal/next level. */
  readonly outro?: string;
  readonly sampleIds: readonly string[];
  readonly toolIds: readonly string[];
  readonly goal: ExperimentGoal;
  readonly scaffolding: ExperimentScaffolding;
  /**
   * When true, the learner must predict a tool's visible result before it is
   * applied, binding prediction to the action rather than a detached quiz.
   * Applies to free-probe goals (`classify`, `reach-target-state`); a
   * `predict-outcome` goal always predicts, so this flag is ignored there.
   */
  readonly predictionRequired: boolean;
  readonly hints: readonly ExperimentHint[];
}

/**
 * A complete ExperimentLab game: one consistent simulation
 * ({@link ExperimentDefinition}), the categories to discover, and the level
 * ladder. This is the unit the validator and analyzer vet and the reducer runs.
 */
export interface ExperimentGame {
  readonly id: string;
  readonly title: string;
  /** The chapter concept this teaches, for author/teacher trust. */
  readonly conceptName?: string;
  readonly definition: ExperimentDefinition;
  readonly categories: readonly ExperimentCategory[];
  readonly levels: readonly ExperimentLevel[];
}
