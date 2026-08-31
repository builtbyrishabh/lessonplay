import {
  isNumericThreshold,
  type ExperimentEffect,
  type ExperimentRule,
  type ExperimentRuleSet,
  type ExperimentSampleState,
  type NumericComparison,
} from "../model/experimentLab";

/**
 * The deterministic cause → effect engine for ExperimentLab.
 *
 * It is pure and depends only on the model: given a sample's current state, a
 * tool id, an optional second-operand state, and a {@link ExperimentRuleSet}, it
 * returns the visible effect and the next state(s). The same inputs always
 * produce the same output, so a learner probing the system sees a *consistent*
 * world they can reason about — the property the whole experiment loop rests on.
 *
 * Rules are evaluated first-match-wins (mirroring the SandboxLab/`Scenario`
 * rule engine), so authors order specific rules before general ones. When no
 * rule matches, the rule set's `defaultEffect` fires and state is unchanged.
 *
 * Two primitives extend the base loop, both additive (absent ⇒ today's
 * behaviour): a rule may compare a **numeric** property (threshold/range) via
 * `numericWhen`, and a **binary** tool combines the sample with a second operand
 * whose state a rule may constrain via `whenOperand` / `numericWhenOperand`.
 */

/** Result of applying one tool to one sample: what is seen and the new state. */
export interface ExperimentStepResult {
  readonly effect: ExperimentEffect;
  readonly nextState: ExperimentSampleState;
  /** True when a declared rule matched; false when the default fallback fired. */
  readonly matched: boolean;
  /**
   * The second operand's next state, present only when an operand state was
   * supplied (i.e. a binary application). Carries any `setOperandState` /
   * `addOperandState` from the effect.
   */
  readonly nextOperandState?: ExperimentSampleState;
}

/**
 * True when every constraint in `when` is satisfied by the sample `state`.
 *
 * A missing `when` is treated as "no constraints" rather than thrown on: the
 * type requires it, but the data is authored by a model at runtime, and the
 * structural validator is where a missing `when` gets reported. Crashing
 * here would turn that clear message into a stack trace from the analyzer.
 */
export function matchesWhen(
  state: ExperimentSampleState,
  when: ExperimentSampleState | undefined,
): boolean {
  if (!when) return true;
  for (const key of Object.keys(when)) {
    if (state[key] !== when[key]) {
      return false;
    }
  }
  return true;
}

/** Read a property as a number, or `undefined` when absent / non-numeric (fail-closed). */
function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * Evaluate one {@link NumericComparison} against the property `lhs`, resolving a
 * `property` right-hand side from the same `state`. Fail-closed: a missing or
 * non-numeric operand on either side never matches.
 */
export function evaluateComparison(
  lhs: ExperimentSampleState[string] | undefined,
  cmp: NumericComparison,
  state: ExperimentSampleState,
): boolean {
  const left = asNumber(lhs);
  if (left === undefined) return false;
  if (isNumericThreshold(cmp)) {
    const right =
      cmp.property !== undefined ? asNumber(state[cmp.property]) : cmp.value;
    if (right === undefined) return false;
    switch (cmp.op) {
      case ">=":
        return left >= right;
      case "<=":
        return left <= right;
      case ">":
        return left > right;
      case "<":
        return left < right;
      case "==":
        return left === right;
    }
  }
  // Range form: inclusive bounds, either may be omitted.
  if (cmp.min !== undefined && left < cmp.min) return false;
  if (cmp.max !== undefined && left > cmp.max) return false;
  return true;
}

/** True when every numeric comparison in `numericWhen` holds for `state`. */
export function matchesNumericWhen(
  state: ExperimentSampleState,
  numericWhen: Readonly<Record<string, NumericComparison>> | undefined,
): boolean {
  if (!numericWhen) return true;
  for (const key of Object.keys(numericWhen)) {
    if (!evaluateComparison(state[key], numericWhen[key], state)) {
      return false;
    }
  }
  return true;
}

/**
 * True when a rule's full constraint set is satisfied: the primary sample's
 * string (`when`) and numeric (`numericWhen`) constraints, plus — for a binary
 * application — the second operand's string (`whenOperand`) and numeric
 * (`numericWhenOperand`) constraints. A rule that constrains the operand never
 * matches a unary application (no operand state supplied).
 */
export function ruleMatches(
  rule: ExperimentRule,
  state: ExperimentSampleState,
  operandState?: ExperimentSampleState,
): boolean {
  if (!matchesWhen(state, rule.when)) return false;
  if (!matchesNumericWhen(state, rule.numericWhen)) return false;
  const constrainsOperand =
    rule.whenOperand !== undefined || rule.numericWhenOperand !== undefined;
  if (constrainsOperand) {
    if (!operandState) return false;
    if (rule.whenOperand && !matchesWhen(operandState, rule.whenOperand)) {
      return false;
    }
    if (!matchesNumericWhen(operandState, rule.numericWhenOperand)) {
      return false;
    }
  }
  return true;
}

/** Find the first rule for `toolId` that fully matches, if any. */
function firstMatchingRule(
  state: ExperimentSampleState,
  toolId: string,
  ruleSet: ExperimentRuleSet,
  operandState?: ExperimentSampleState,
): ExperimentRule | undefined {
  return ruleSet.rules.find(
    (rule) => rule.toolId === toolId && ruleMatches(rule, state, operandState),
  );
}

/**
 * Merge a state delta: `setState` replaces the named properties (absolute set),
 * then `addState` adds numeric deltas (a missing base is treated as 0). Returns
 * the same reference when there is nothing to change, so callers can cheaply
 * detect "state unchanged".
 */
export function applyStateDelta(
  state: ExperimentSampleState,
  setState?: ExperimentSampleState,
  addState?: Readonly<Record<string, number>>,
): ExperimentSampleState {
  if (!setState && !addState) return state;
  const next: Record<string, ExperimentSampleState[string]> = {
    ...state,
    ...setState,
  };
  if (addState) {
    for (const key of Object.keys(addState)) {
      const base = asNumber(next[key]) ?? 0;
      next[key] = base + addState[key];
    }
  }
  return next;
}

/**
 * Apply one tool to a sample's current state. Returns the visible effect and the
 * next state (the prior state with the effect's `setState`/`addState` merged in).
 * Pass `operandState` to apply a binary tool against a second operand; the
 * operand's next state (with `setOperandState`/`addOperandState` merged) is
 * returned as `nextOperandState`.
 */
export function runExperimentStep(
  state: ExperimentSampleState,
  toolId: string,
  ruleSet: ExperimentRuleSet,
  operandState?: ExperimentSampleState,
): ExperimentStepResult {
  const rule = firstMatchingRule(state, toolId, ruleSet, operandState);
  const effect = rule ? rule.effect : ruleSet.defaultEffect;
  const nextState = applyStateDelta(state, effect.setState, effect.addState);
  const result: ExperimentStepResult = {
    effect,
    nextState,
    matched: rule !== undefined,
  };
  if (operandState === undefined) return result;
  return {
    ...result,
    nextOperandState: applyStateDelta(
      operandState,
      effect.setOperandState,
      effect.addOperandState,
    ),
  };
}

/** One step of an ordered probe sequence: a tool and an optional operand state. */
export interface ExperimentSequenceStep {
  readonly toolId: string;
  readonly operandState?: ExperimentSampleState;
}

/**
 * Apply an ordered sequence of tools to one starting state, threading the
 * evolving state through each step. Accepts either bare tool ids (unary, as
 * before) or {@link ExperimentSequenceStep}s carrying a per-step operand. Useful
 * for the solver and for tests that exercise effects which depend on a prior
 * cause (e.g. an amount that accumulates to a saturation point).
 */
export function runExperimentSequence(
  initialState: ExperimentSampleState,
  steps: readonly (string | ExperimentSequenceStep)[],
  ruleSet: ExperimentRuleSet,
): {
  readonly results: readonly ExperimentStepResult[];
  readonly finalState: ExperimentSampleState;
} {
  const results: ExperimentStepResult[] = [];
  let state = initialState;
  for (const step of steps) {
    const { toolId, operandState } =
      typeof step === "string" ? { toolId: step, operandState: undefined } : step;
    const result = runExperimentStep(state, toolId, ruleSet, operandState);
    results.push(result);
    state = result.nextState;
  }
  return { results, finalState: state };
}
