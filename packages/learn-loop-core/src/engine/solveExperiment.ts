import {
  isPredictOutcomeGoal,
  isReachTargetStateGoal,
  type ClassifyGoal,
  type ExperimentDefinition,
  type ExperimentGoalKind,
  type ExperimentLevel,
  type ExperimentRuleSet,
  type ExperimentSample,
  type ExperimentSampleState,
  type ExperimentTool,
  type NumericComparison,
  type PredictOutcomeGoal,
  type ReachTargetStateGoal,
} from "../model/experimentLab";
import type { ValidationResult } from "../model/scenario";
import {
  matchesNumericWhen,
  matchesWhen,
  runExperimentSequence,
  runExperimentStep,
} from "./experimentRules";
import {
  effectEvidenceToken,
  probeActionKey,
  type ProbeAction,
} from "./experimentSignature";

/**
 * Search depth cap for the reach-target-state reachability proof. Real
 * transformation activities reach their target in a handful of moves; the cap
 * keeps the breadth-first search bounded on the (possibly numeric) state space.
 */
const REACH_MAX_DEPTH = 8;

/**
 * The deterministic quality verdict for one level — the reviewer's backbone.
 *
 * A good level is **winnable by reasoning** yet not winnable by the two cheats
 * the cause→effect loop is meant to defeat:
 *
 *   - **brute-forceable** — the answer can be guessed without evidence (too few
 *     samples or too few distinct categories to reason about).
 *   - **railed** — there is no meaningful choice: a single *action* already
 *     separates every category (so "combine causes" is a lie), or fewer than two
 *     actions are available at all.
 *
 * With the binary primitive an "action" is a (tool, operand) pair, not just a
 * tool: one binary tool combined with several operands is several actions, a
 * real choice. Tutorial levels (`scaffolding: "guided"`) are intentionally
 * trivial and railed to teach one cause, so those two defects are not flagged
 * for them.
 */
export interface ExperimentAnalysis {
  readonly levelId: string;
  /** Which goal shape was analysed (the checks below are goal-specific). */
  readonly goalKind: ExperimentGoalKind;
  /**
   * The level is achievable *and* fair for its goal kind:
   *   - classify: every different-category sample pair can be told apart.
   *   - predict-outcome: prompts are valid and not answerable by one guess.
   *   - reach-target-state: the target is reachable and not already satisfied.
   */
  readonly winnable: boolean;
  /**
   * The answer can be reached without evidence. For classify: too few
   * samples/categories to reason about. For predict-outcome: the prompts share a
   * single answer, so one repeated guess wins. Never flagged for
   * reach-target-state. (Also false on guided tutorials, which may be trivial.)
   */
  readonly bruteForceable: boolean;
  /**
   * classify-only: a single action already separates every category (no real
   * "combine causes"), or fewer than two actions are available. False otherwise.
   */
  readonly railed: boolean;
  /** classify-only: different-category sample pairs that share a signature. */
  readonly indistinguishablePairs: readonly (readonly [string, string])[];
  /**
   * classify: smallest action subset that separates all categories (`> 1` marks
   * a genuine "combine causes" level). reach-target-state: the fewest actions
   * that reach the target. `Infinity` when unachievable; `0` when not applicable.
   */
  readonly toolsNeeded: number;
  /** Human-readable, ship-blocking problems (empty ⇒ the level is acceptable). */
  readonly errors: readonly string[];
}

function resolveSamples(
  ids: readonly string[],
  definition: ExperimentDefinition,
): { samples: ExperimentSample[]; missing: string[] } {
  const samples: ExperimentSample[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const found = definition.samples.find((s) => s.id === id);
    if (found) samples.push(found);
    else missing.push(id);
  }
  return { samples, missing };
}

/**
 * The initial state of an operand id — a bench sample's or a shelf reagent's
 * hidden properties — or `undefined` when the id resolves to neither. A learner
 * grabs a fresh operand each time, so the analyzer uses the operand's *initial*
 * properties for every probe.
 */
function operandInitialState(
  operandId: string,
  definition: ExperimentDefinition,
): ExperimentSampleState | undefined {
  const sample = definition.samples.find((s) => s.id === operandId);
  if (sample) return sample.properties;
  const reagent = definition.reagents?.find((r) => r.id === operandId);
  return reagent?.properties;
}

/** Look up a tool spec by id. */
function toolById(
  toolId: string,
  definition: ExperimentDefinition,
): ExperimentTool | undefined {
  return definition.tools.find((t) => t.id === toolId);
}

/**
 * Expand the level's offered tools into the full **probe action** space
 * `(tool, operand?)`. A unary tool is one action; a binary tool is one action
 * per available operand — every shelf reagent for a `reagent` tool, every bench
 * sample for a `sample` tool. This is the action set over which classify
 * distinguishability, railing, and minimal-subset are measured.
 */
export function buildProbeActions(
  definition: ExperimentDefinition,
  level: ExperimentLevel,
): ProbeAction[] {
  const actions: ProbeAction[] = [];
  for (const toolId of level.toolIds) {
    const spec = toolById(toolId, definition);
    if (!spec?.operand) {
      actions.push({ toolId });
      continue;
    }
    const operandIds =
      spec.operand.kind === "reagent"
        ? (definition.reagents ?? []).map((r) => r.id)
        : level.sampleIds;
    for (const operandId of operandIds) {
      const operandState = operandInitialState(operandId, definition);
      if (operandState === undefined) continue;
      actions.push({ toolId, operandId, operandState });
    }
  }
  return actions;
}

type StatefulExperimentSignature = Readonly<Record<string, string>>;

function signatureKey(action: ProbeAction, index: number): string {
  return `${index}:${probeActionKey(action)}`;
}

/**
 * Compute the visible evidence from applying probe actions in the same order a
 * learner can apply them during a session, carrying `setState`/`addState` on the
 * primary sample between probes (each operand is used fresh). Each step is
 * reduced to its {@link effectEvidenceToken}, so a difference in colour, pH
 * value, bulb state, gas label, or a measured number counts as distinguishing
 * evidence — as does a difference in which operand produced it.
 */
function statefulSignature(
  sample: ExperimentSample,
  actions: readonly ProbeAction[],
  ruleSet: ExperimentRuleSet,
): StatefulExperimentSignature {
  const signature: Record<string, string> = {};
  const { results } = runExperimentSequence(
    sample.properties,
    actions.map((a) => ({ toolId: a.toolId, operandState: a.operandState })),
    ruleSet,
  );
  results.forEach((result, index) => {
    signature[signatureKey(actions[index], index)] = effectEvidenceToken(
      result.effect,
    );
  });
  return signature;
}

function signaturesDiffer(
  a: StatefulExperimentSignature,
  b: StatefulExperimentSignature,
  actions: readonly ProbeAction[],
): boolean {
  return actions.some(
    (action, index) =>
      a[signatureKey(action, index)] !== b[signatureKey(action, index)],
  );
}

/** Do all classify samples of different categories differ under this one action? */
function actionSeparatesAllCategories(
  action: ProbeAction,
  samples: readonly ExperimentSample[],
  definition: ExperimentDefinition,
): boolean {
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      if (samples[i].categoryId === samples[j].categoryId) continue;
      const a = statefulSignature(samples[i], [action], definition.ruleSet);
      const b = statefulSignature(samples[j], [action], definition.ruleSet);
      if (!signaturesDiffer(a, b, [action])) return false;
    }
  }
  return true;
}

/** True when this action set tells every different-category pair apart. */
function actionsSeparateAll(
  actions: readonly ProbeAction[],
  samples: readonly ExperimentSample[],
  definition: ExperimentDefinition,
): boolean {
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      if (samples[i].categoryId === samples[j].categoryId) continue;
      const a = statefulSignature(samples[i], actions, definition.ruleSet);
      const b = statefulSignature(samples[j], actions, definition.ruleSet);
      if (!signaturesDiffer(a, b, actions)) return false;
    }
  }
  return true;
}

/** Smallest subset of `actions` that separates all categories, or Infinity. */
function minimalSeparatingSize(
  actions: readonly ProbeAction[],
  samples: readonly ExperimentSample[],
  definition: ExperimentDefinition,
): number {
  for (let size = 1; size <= actions.length; size++) {
    const found = subsetsOfSize(actions, size).some((subset) =>
      actionsSeparateAll(subset, samples, definition),
    );
    if (found) return size;
  }
  return Number.POSITIVE_INFINITY;
}

function subsetsOfSize<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (size > items.length) return [];
  const [first, ...rest] = items;
  const withFirst = subsetsOfSize(rest, size - 1).map((s) => [first, ...s]);
  const withoutFirst = subsetsOfSize(rest, size);
  return [...withFirst, ...withoutFirst];
}

/**
 * Prove a level is winnable by reasoning and reject the cheats appropriate to
 * its goal kind. Pure and dependent only on the definition + level, so it is a
 * deep, deterministic module that anchors both the build-time gate and the
 * reviewer. Dispatches on the goal's discriminant.
 */
export function solveExperiment(
  definition: ExperimentDefinition,
  level: ExperimentLevel,
): ExperimentAnalysis {
  const goal = level.goal;
  if (isPredictOutcomeGoal(goal)) {
    return solvePredictOutcome(definition, level, goal);
  }
  if (isReachTargetStateGoal(goal)) {
    return solveReachTargetState(definition, level, goal);
  }
  return solveClassify(definition, level, goal);
}

/**
 * classify: prove every different-category pair is distinguishable, and reject
 * the brute-force (too few samples/categories) and rail (one action separates
 * everything, or fewer than two actions) cheats.
 */
function solveClassify(
  definition: ExperimentDefinition,
  level: ExperimentLevel,
  goal: ClassifyGoal,
): ExperimentAnalysis {
  const errors: string[] = [];
  const { samples: classifySamples, missing } = resolveSamples(
    goal.classifyIds,
    definition,
  );
  for (const id of missing) {
    errors.push(
      `level "${level.id}" classifies sample "${id}" but no such sample exists`,
    );
  }

  const offered = new Set(goal.categoryIds);
  for (const sample of classifySamples) {
    if (!offered.has(sample.categoryId)) {
      errors.push(
        `level "${level.id}": sample "${sample.id}" is category "${sample.categoryId}" but that category is not offered as a choice`,
      );
    }
  }

  const actions = buildProbeActions(definition, level);

  // Distinguishability: every pair of classify samples in *different*
  // categories must differ under the available actions.
  const indistinguishablePairs: (readonly [string, string])[] = [];
  for (let i = 0; i < classifySamples.length; i++) {
    for (let j = i + 1; j < classifySamples.length; j++) {
      const a = classifySamples[i];
      const b = classifySamples[j];
      if (a.categoryId === b.categoryId) continue;
      const sigA = statefulSignature(a, actions, definition.ruleSet);
      const sigB = statefulSignature(b, actions, definition.ruleSet);
      if (!signaturesDiffer(sigA, sigB, actions)) {
        indistinguishablePairs.push([a.id, b.id]);
        errors.push(
          `level "${level.id}": samples "${a.id}" (${a.categoryId}) and "${b.id}" (${b.categoryId}) are indistinguishable with the available tools, so the level cannot be won by reasoning`,
        );
      }
    }
  }

  const winnable =
    missing.length === 0 &&
    indistinguishablePairs.length === 0 &&
    classifySamples.every((s) => offered.has(s.categoryId));

  const distinctCategories = new Set(
    classifySamples.map((s) => s.categoryId),
  ).size;
  const isTutorial = level.scaffolding === "guided";

  const bruteForceable =
    !isTutorial && (classifySamples.length < 2 || distinctCategories < 2);
  if (bruteForceable) {
    errors.push(
      `level "${level.id}" is brute-forceable: with ${classifySamples.length} sample(s) across ${distinctCategories} categor(y/ies) the answer can be guessed without running the distinguishing tests`,
    );
  }

  const singleActionSeparates = actions.some((action) =>
    actionSeparatesAllCategories(action, classifySamples, definition),
  );
  const railed = !isTutorial && (actions.length < 2 || singleActionSeparates);
  if (railed) {
    errors.push(
      actions.length < 2
        ? `level "${level.id}" is railed: fewer than two actions are available, so there is no meaningful choice`
        : `level "${level.id}" is railed: a single action already separates every category, so "combine causes" is not actually required`,
    );
  }

  const toolsNeeded = minimalSeparatingSize(actions, classifySamples, definition);

  return {
    levelId: level.id,
    goalKind: "classify",
    winnable,
    bruteForceable,
    railed,
    indistinguishablePairs,
    toolsNeeded,
    errors,
  };
}

/**
 * predict-outcome: prove each prompt names a real sample/tool (and a resolvable
 * operand, for binary prompts) on the bench, and that the prompts are not
 * answerable by one repeated guess — the correct evidence token must vary
 * across at least two prompts (guided tutorials are exempt).
 */
function solvePredictOutcome(
  definition: ExperimentDefinition,
  level: ExperimentLevel,
  goal: PredictOutcomeGoal,
): ExperimentAnalysis {
  const errors: string[] = [];
  const onBench = new Set(level.sampleIds);
  const offeredTools = new Set(level.toolIds);
  const isTutorial = level.scaffolding === "guided";

  if (goal.prompts.length === 0) {
    errors.push(
      `level "${level.id}" is a predict-outcome level but lists no prompts`,
    );
  }

  // The distinct evidence tokens a learner would have to predict across prompts.
  const predictedEvidence: string[] = [];
  for (const prompt of goal.prompts) {
    const sample = definition.samples.find((s) => s.id === prompt.sampleId);
    if (!sample) {
      errors.push(
        `level "${level.id}" prompts sample "${prompt.sampleId}" but no such sample exists`,
      );
      continue;
    }
    if (!onBench.has(prompt.sampleId)) {
      errors.push(
        `level "${level.id}" prompts sample "${prompt.sampleId}" which is not on the bench in that level`,
      );
    }
    if (!offeredTools.has(prompt.toolId)) {
      errors.push(
        `level "${level.id}" prompts tool "${prompt.toolId}" which is not offered in that level`,
      );
    }
    let operandState: ExperimentSampleState | undefined;
    if (prompt.operandId !== undefined) {
      operandState = operandInitialState(prompt.operandId, definition);
      if (operandState === undefined) {
        errors.push(
          `level "${level.id}" prompts operand "${prompt.operandId}" which is neither a sample nor a shelf reagent`,
        );
      }
    }
    const { effect } = runExperimentStep(
      sample.properties,
      prompt.toolId,
      definition.ruleSet,
      operandState,
    );
    predictedEvidence.push(effectEvidenceToken(effect));
  }

  const distinctEvidence = new Set(predictedEvidence).size;
  const guessable =
    !isTutorial && (goal.prompts.length < 2 || distinctEvidence < 2);
  if (guessable) {
    errors.push(
      `level "${level.id}" is guessable: its predict-outcome prompts do not have at least two different answers, so a single repeated prediction wins`,
    );
  }

  return {
    levelId: level.id,
    goalKind: "predict-outcome",
    winnable: errors.length === 0,
    bruteForceable: guessable,
    railed: false,
    indistinguishablePairs: [],
    toolsNeeded: 0,
    errors,
  };
}

/** True when a sample state satisfies both the string and numeric target. */
function matchesTarget(
  state: ExperimentSampleState,
  target: ExperimentSampleState,
  numericTarget: Readonly<Record<string, NumericComparison>> | undefined,
): boolean {
  return matchesWhen(state, target) && matchesNumericWhen(state, numericTarget);
}

/**
 * reach-target-state: prove the target (string and any numeric condition) is
 * reachable from the sample's initial state with the offered tools (a
 * breadth-first search whose edges expand over (tool, operand) pairs), and that
 * it is not already satisfied at the start.
 */
function solveReachTargetState(
  definition: ExperimentDefinition,
  level: ExperimentLevel,
  goal: ReachTargetStateGoal,
): ExperimentAnalysis {
  const errors: string[] = [];
  const sample = definition.samples.find((s) => s.id === goal.sampleId);

  if (!sample) {
    errors.push(
      `level "${level.id}" targets sample "${goal.sampleId}" but no such sample exists`,
    );
    return {
      levelId: level.id,
      goalKind: "reach-target-state",
      winnable: false,
      bruteForceable: false,
      railed: false,
      indistinguishablePairs: [],
      toolsNeeded: Number.POSITIVE_INFINITY,
      errors,
    };
  }

  if (!level.sampleIds.includes(goal.sampleId)) {
    errors.push(
      `level "${level.id}" targets sample "${goal.sampleId}" which is not on the bench in that level`,
    );
  }
  if (
    Object.keys(goal.target).length === 0 &&
    Object.keys(goal.numericTarget ?? {}).length === 0
  ) {
    errors.push(`level "${level.id}" has an empty reach-target-state target`);
  }

  const triviallyReachable = matchesTarget(
    sample.properties,
    goal.target,
    goal.numericTarget,
  );
  if (triviallyReachable) {
    errors.push(
      `level "${level.id}" target is already satisfied by the sample's initial state, so it needs no action` +
        ` — for a reversible round-trip (e.g. heat then rehydrate back to the start colour), set a history marker in the forward step's setState and include that marker in the target so the goal state is distinct from the start`,
    );
  }

  const actions = buildProbeActions(definition, level);
  const stepsToTarget = minStepsToTarget(sample.properties, goal, actions, definition);
  const reachable = Number.isFinite(stepsToTarget);
  if (!triviallyReachable && !reachable) {
    errors.push(
      `level "${level.id}" target cannot be reached from the sample's initial state with the offered tools`,
    );
  }

  return {
    levelId: level.id,
    goalKind: "reach-target-state",
    winnable: reachable && !triviallyReachable && errors.length === 0,
    bruteForceable: false,
    railed: false,
    indistinguishablePairs: [],
    toolsNeeded: stepsToTarget,
    errors,
  };
}

/** Stable key for a property state, so the BFS can dedupe visited states. */
function stateKey(state: ExperimentSampleState): string {
  return Object.keys(state)
    .sort()
    .map((k) => `${k}=${state[k]}`)
    .join("&");
}

/**
 * Fewest probe actions that drive `initial` to a state satisfying the goal, or
 * `Infinity` if no sequence within {@link REACH_MAX_DEPTH} does. A plain BFS over
 * the property state space; each (tool, operand) is a deterministic edge.
 */
function minStepsToTarget(
  initial: ExperimentSampleState,
  goal: ReachTargetStateGoal,
  actions: readonly ProbeAction[],
  definition: ExperimentDefinition,
): number {
  if (matchesTarget(initial, goal.target, goal.numericTarget)) return 0;
  const visited = new Set<string>([stateKey(initial)]);
  let frontier: ExperimentSampleState[] = [initial];
  for (let depth = 1; depth <= REACH_MAX_DEPTH; depth++) {
    const next: ExperimentSampleState[] = [];
    for (const state of frontier) {
      for (const action of actions) {
        const { nextState } = runExperimentStep(
          state,
          action.toolId,
          definition.ruleSet,
          action.operandState,
        );
        const key = stateKey(nextState);
        if (visited.has(key)) continue;
        visited.add(key);
        if (matchesTarget(nextState, goal.target, goal.numericTarget)) {
          return depth;
        }
        next.push(nextState);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Run {@link solveExperiment} across every level of a game and fold the result
 * into the shared {@link ValidationResult} shape, so the build-time gate can
 * treat a quality defect exactly like a structural one.
 */
export function analyzeExperimentGame(game: {
  readonly definition: ExperimentDefinition;
  readonly levels: readonly ExperimentLevel[];
}): ValidationResult {
  const errors: string[] = [];
  for (const level of game.levels) {
    errors.push(...solveExperiment(game.definition, level).errors);
  }
  return { ok: errors.length === 0, errors };
}
