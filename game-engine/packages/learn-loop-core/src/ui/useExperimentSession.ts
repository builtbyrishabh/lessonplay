import { useEffect, useMemo, useReducer, useState } from "react";
import {
  experimentGoalKind,
  isPredictOutcomeGoal,
  isReachTargetStateGoal,
  type ExperimentGame,
  type ExperimentGoalKind,
  type ExperimentLevel,
  type ExperimentReadout,
  type ExperimentSample,
  type ExperimentTool,
  type ExperimentVisual,
} from "../model/experimentLab";
import {
  canClassify,
  createExperimentSession,
  currentLevel,
  reduceExperimentSession,
  type ExperimentSessionState,
} from "../engine/experimentSession";

/**
 * How long an effect plays out before the bench reopens for the next action.
 * The effect itself lingers (via the notebook lookup) until the player acts
 * again, so the "money shot" stays on screen for a screenshot.
 */
export const EXPERIMENT_OBSERVE_MS = 1400;

export interface ExperimentSession {
  readonly state: ExperimentSessionState;
  readonly level: ExperimentLevel;
  /** True while an effect is animating; the bench is not interactive. */
  readonly busy: boolean;
  /** True only in the free-probing phase, when inputs are live. */
  readonly interactive: boolean;
  /** True while awaiting the learner's prediction for the chosen tool. */
  readonly predicting: boolean;
  /** Whether every sample that must be classified has been probed. */
  readonly canClassify: boolean;
  /** Which goal shape this level uses, so the viewport can render the right beats. */
  readonly goalKind: ExperimentGoalKind;
  /**
   * predict-outcome progress: the active prompt index and the prompt count.
   * `total` is 0 for the other goal kinds.
   */
  readonly promptProgress: { readonly index: number; readonly total: number };
  /** predict-outcome score so far: correct predictions out of the prompt count. */
  readonly predictionScore: { readonly correct: number; readonly total: number };
  /** reach-target-state: the learner-facing goal label, else null. */
  readonly targetLabel: string | null;
  readonly selectedSample: ExperimentSample | undefined;
  /** The tool awaiting a prediction (only set in the `predicting` phase). */
  readonly selectedTool: ExperimentTool | undefined;
  /** The distinct effects the chosen tool can produce, as prediction choices. */
  readonly predictChoices: readonly ExperimentVisual[];
  /**
   * True while a binary tool has been chosen but its second operand has not: the
   * viewport shows the operand picker before the tool is dispatched. Only ever
   * true in the free-probing phase.
   */
  readonly awaitingOperand: boolean;
  /** The binary tool awaiting an operand (only set while `awaitingOperand`). */
  readonly operandTool: ExperimentTool | undefined;
  /**
   * The second-operand choices for the pending binary tool: every shelf reagent
   * for a `reagent` tool, or every *other* bench sample for a `sample` tool.
   */
  readonly operandChoices: readonly { readonly id: string; readonly label: string }[];
  /**
   * After an effect plays, whether the learner's prediction matched: "correct"
   * or "wrong"; null when this level required no prediction.
   */
  readonly predictionOutcome: "correct" | "wrong" | null;
  /** The effect the beaker should show right now (live or last recorded). */
  readonly activeVisual: ExperimentVisual;
  /** Gas chip token for the active `gas` visual, if any (e.g. "H₂"). */
  readonly activeGasLabel: string | undefined;
  /** Structured reading for the active effect (drives the `measure` balance plate). */
  readonly activeReadout: ExperimentReadout | undefined;
  /** Whether the selected sample has ever shown a floating-particle look. */
  readonly cloudy: boolean;
  /** Sensory text for the selected sample's most recent reading, if any. */
  readonly reading: string | null;
  readonly sampleById: ReadonlyMap<string, ExperimentSample>;
  /** A recorded probe for one (sample, tool), if it exists. */
  readonly readingFor: (
    sampleId: string,
    toolId: string,
  ) => ExperimentSessionState["notebook"][number] | undefined;
  readonly startLevel: () => void;
  readonly selectSample: (sampleId: string) => void;
  /**
   * Choose a tool. A unary tool dispatches immediately; a binary tool instead
   * opens the operand picker (`awaitingOperand`) and waits for {@link selectOperand}.
   */
  readonly selectTool: (toolId: string) => void;
  /** Commit the second operand for the pending binary tool, applying it. */
  readonly selectOperand: (operandId: string) => void;
  /** Abandon the pending binary tool without acting (close the operand picker). */
  readonly cancelOperand: () => void;
  /** Commit a predicted effect, which then applies the tool and reconciles. */
  readonly predict: (visual: ExperimentVisual) => void;
  readonly requestHint: () => void;
  readonly openClassify: () => void;
  readonly assignCategory: (sampleId: string, categoryId: string) => void;
  readonly submitClassification: () => void;
  readonly nextLevel: () => void;
  readonly reset: () => void;
}

/**
 * Drives an {@link ExperimentLabViewport} from the already-tested session
 * reducer. It owns the observe→reopen timer and the derived view helpers (the
 * active visual, cloudiness, the latest reading) so the viewport is pure markup.
 * No gameplay rule lives here — every transition goes through
 * {@link reduceExperimentSession}.
 */
export function useExperimentSession(game: ExperimentGame): ExperimentSession {
  const [state, dispatch] = useReducer(
    reduceExperimentSession,
    game,
    createExperimentSession,
  );

  // A binary tool needs a second operand before it can act. That pick is a pure
  // UI step (the reducer already accepts `operandId` on select-tool), so it lives
  // here as local state rather than as a new reducer phase.
  const [pendingOperandToolId, setPendingOperandToolId] = useState<string | null>(
    null,
  );

  const level = currentLevel(state);
  const samples = game.definition.samples;
  const sampleById = useMemo(
    () => new Map(samples.map((s) => [s.id, s])),
    [samples],
  );

  // The effect animates live, records itself, then the bench reopens.
  useEffect(() => {
    if (state.phase !== "observing") return;
    const t = setTimeout(
      () => dispatch({ type: "dismiss-observation" }),
      EXPERIMENT_OBSERVE_MS,
    );
    return () => clearTimeout(t);
  }, [state.phase, state.lastObservation]);

  const busy = state.phase === "observing";
  const interactive = state.phase === "exploring";
  const predicting = state.phase === "predicting";
  const selectedSample = state.selectedSampleId
    ? sampleById.get(state.selectedSampleId)
    : undefined;
  const selectedTool =
    predicting && state.selectedToolId
      ? game.definition.tools.find((t) => t.id === state.selectedToolId)
      : undefined;
  const predictChoices =
    predicting && state.selectedToolId
      ? predictChoicesFor(game, state.selectedToolId)
      : EMPTY_CHOICES;
  const predictionOutcome: "correct" | "wrong" | null =
    state.phase === "observing" &&
    state.lastObservation &&
    state.lastObservation.predictionCorrect !== null
      ? state.lastObservation.predictionCorrect
        ? "correct"
        : "wrong"
      : null;

  const goalKind = experimentGoalKind(level.goal);
  const promptTotal = isPredictOutcomeGoal(level.goal)
    ? level.goal.prompts.length
    : 0;
  const targetLabel = isReachTargetStateGoal(level.goal)
    ? level.goal.targetLabel
    : null;

  // The operand picker is only meaningful while free probing; leaving the
  // exploring phase (or resetting) always dismisses it.
  const operandTool =
    interactive && pendingOperandToolId
      ? game.definition.tools.find((t) => t.id === pendingOperandToolId)
      : undefined;
  const awaitingOperand = operandTool !== undefined;
  const operandChoices = useMemo(
    () => operandChoicesFor(game, level, operandTool, state.selectedSampleId, sampleById),
    [game, level, operandTool, state.selectedSampleId, sampleById],
  );

  return {
    state,
    level,
    busy,
    interactive,
    predicting,
    canClassify: canClassify(state),
    goalKind,
    promptProgress: { index: state.promptIndex, total: promptTotal },
    predictionScore: { correct: state.predictionsCorrect, total: promptTotal },
    targetLabel,
    selectedSample,
    selectedTool,
    predictChoices,
    awaitingOperand,
    operandTool,
    operandChoices,
    predictionOutcome,
    activeVisual: activeVisual(state),
    activeGasLabel: activeGasLabel(state),
    activeReadout: activeReadout(state),
    cloudy: isCloudy(state),
    reading: latestReadingFor(state),
    sampleById,
    readingFor: (sampleId, toolId) =>
      state.notebook.find(
        (e) => e.sampleId === sampleId && e.toolId === toolId,
      ),
    startLevel: () => dispatch({ type: "start-level" }),
    selectSample: (sampleId) => dispatch({ type: "select-sample", sampleId }),
    selectTool: (toolId) => {
      // A binary tool defers to the operand picker; a unary tool acts at once.
      const tool = game.definition.tools.find((t) => t.id === toolId);
      if (tool?.operand) {
        setPendingOperandToolId(toolId);
        return;
      }
      dispatch({ type: "select-tool", toolId });
    },
    selectOperand: (operandId) => {
      if (!pendingOperandToolId) return;
      dispatch({ type: "select-tool", toolId: pendingOperandToolId, operandId });
      setPendingOperandToolId(null);
    },
    cancelOperand: () => setPendingOperandToolId(null),
    predict: (visual) => dispatch({ type: "predict", visual }),
    requestHint: () => dispatch({ type: "request-hint" }),
    openClassify: () => dispatch({ type: "open-classify" }),
    assignCategory: (sampleId, categoryId) =>
      dispatch({ type: "assign-category", sampleId, categoryId }),
    submitClassification: () => dispatch({ type: "submit-classification" }),
    nextLevel: () => dispatch({ type: "next-level" }),
    reset: () => {
      setPendingOperandToolId(null);
      dispatch({ type: "reset" });
    },
  };
}

const EMPTY_CHOICES: readonly ExperimentVisual[] = [];
const EMPTY_OPERANDS: readonly { id: string; label: string }[] = [];

/**
 * The second-operand choices for a pending binary tool. A `reagent` tool draws
 * from the shared shelf; a `sample` tool combines with any *other* bench sample
 * present in the level (never with itself). Empty when the tool is unary or none
 * is pending, so the picker only shows real, resolvable operands.
 */
function operandChoicesFor(
  game: ExperimentGame,
  level: ExperimentLevel,
  operandTool: ExperimentTool | undefined,
  selectedSampleId: string | null,
  sampleById: ReadonlyMap<string, ExperimentSample>,
): readonly { id: string; label: string }[] {
  const operand = operandTool?.operand;
  if (!operand) return EMPTY_OPERANDS;
  if (operand.kind === "reagent") {
    return (game.definition.reagents ?? []).map((r) => ({
      id: r.id,
      label: r.label,
    }));
  }
  return level.sampleIds
    .filter((id) => id !== selectedSampleId)
    .map((id) => sampleById.get(id))
    .filter((s): s is ExperimentSample => s !== undefined)
    .map((s) => ({ id: s.id, label: s.label }));
}

/**
 * The distinct effects a tool can produce across the whole world, offered as
 * prediction options. Derived from every rule that fires for the tool plus the
 * default effect, so it is honest (only outcomes the tool can really show) and
 * never leaks which sample is which. Padded with "none" so there is always a
 * genuine choice (will it react, or not?).
 */
function predictChoicesFor(
  game: ExperimentGame,
  toolId: string,
): readonly ExperimentVisual[] {
  const ruleSet = game.definition.ruleSet;
  const choices: ExperimentVisual[] = [];
  for (const rule of ruleSet.rules) {
    if (rule.toolId === toolId && !choices.includes(rule.effect.visual)) {
      choices.push(rule.effect.visual);
    }
  }
  const fallback = ruleSet.defaultEffect.visual;
  if (!choices.includes(fallback)) choices.push(fallback);
  if (choices.length < 2 && !choices.includes("none")) choices.push("none");
  return choices;
}

/** The effect the beaker should show right now. */
function activeVisual(state: ExperimentSessionState): ExperimentVisual {
  if (state.phase === "observing" && state.lastObservation) {
    return state.lastObservation.effect.visual;
  }
  const sid = state.selectedSampleId;
  if (!sid) return "none";
  const entries = state.notebook.filter((e) => e.sampleId === sid);
  return entries.length ? entries[entries.length - 1].visual : "none";
}

/** The gas chip token the beaker should show right now, if the visual is gas. */
function activeGasLabel(state: ExperimentSessionState): string | undefined {
  if (state.phase === "observing" && state.lastObservation) {
    return state.lastObservation.effect.gasLabel;
  }
  const sid = state.selectedSampleId;
  if (!sid) return undefined;
  const entries = state.notebook.filter((e) => e.sampleId === sid);
  return entries.length ? entries[entries.length - 1].gasLabel : undefined;
}

/** The structured reading the beaker should surface right now (for `measure`). */
function activeReadout(
  state: ExperimentSessionState,
): ExperimentReadout | undefined {
  if (state.phase === "observing" && state.lastObservation) {
    return state.lastObservation.effect.readout;
  }
  const sid = state.selectedSampleId;
  if (!sid) return undefined;
  const entries = state.notebook.filter((e) => e.sampleId === sid);
  return entries.length ? entries[entries.length - 1].readout : undefined;
}

/** Whether the selected sample has revealed any floating-particle look. */
function isCloudy(state: ExperimentSessionState): boolean {
  const sid = state.selectedSampleId;
  if (!sid) return false;
  return state.notebook.some(
    (e) => e.sampleId === sid && (e.visual === "beam" || e.visual === "settle"),
  );
}

/** The sensory text for the selected sample's most recent reading. */
function latestReadingFor(state: ExperimentSessionState): string | null {
  const sid = state.selectedSampleId;
  if (!sid) return null;
  const entries = state.notebook.filter((e) => e.sampleId === sid);
  return entries.length ? entries[entries.length - 1].observation : null;
}
