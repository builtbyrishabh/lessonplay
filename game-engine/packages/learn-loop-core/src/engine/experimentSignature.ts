import type {
  ExperimentEffect,
  ExperimentRuleSet,
  ExperimentSample,
  ExperimentSampleState,
} from "../model/experimentLab";
import { runExperimentStep } from "./experimentRules";

/**
 * The *visible* signature of a sample: the distinguishing evidence each tool
 * produces.
 *
 * Distinguishability is computed on what a learner can actually tell apart, not
 * on `observationId`, on purpose. The salient cause a learner reasons about is
 * what they *see and read off* — a beam, a settling layer, a bulb that lights,
 * the specific colour a strip turns. The designed ambiguity (a colloid and a
 * suspension both scatter light) lives at this evidence level, so measuring
 * separation by evidence is what makes "you must combine causes" mechanically
 * true. Each tool is applied independently to the sample's fresh hidden state,
 * mirroring how a learner probes one cause at a time.
 *
 * Evidence is the {@link ExperimentVisual} plus any discriminating detail the
 * effect carries — a {@link ExperimentReadout} (colour, pH value, bulb state,
 * temperature, odour) or a `gasLabel`. Two effects with the same `visual` but a
 * different readout `value` (red vs blue litmus, bulb on vs off) are therefore
 * distinguishable, which is exactly why readouts are structured data.
 */
export type ExperimentSignature = Readonly<Record<string, string>>;

/**
 * The evidence token for one effect: the visual plus any discriminating detail
 * (gas label, structured readout). This is the single definition of "what a
 * learner can tell apart", shared by the signature here and the stateful
 * signature in the analyzer, so both measure distinguishability identically.
 */
export function effectEvidenceToken(effect: ExperimentEffect): string {
  const parts: string[] = [effect.visual];
  if (effect.gasLabel) {
    parts.push(`gas=${effect.gasLabel}`);
  }
  if (effect.readout) {
    parts.push(`${effect.readout.kind}=${effect.readout.value}`);
  }
  return parts.join("|");
}

/**
 * One thing a learner can *do* to a sample: apply `toolId`, optionally combining
 * it with a second operand. For a binary tool the operand's identity (`operandId`)
 * and its state (`operandState`) are both part of the action, so "A combined with
 * X" and "A combined with Y" are distinct probes with potentially distinct
 * evidence. A bare tool id (no operand) is the unary action, as before.
 */
export interface ProbeAction {
  readonly toolId: string;
  readonly operandId?: string;
  readonly operandState?: ExperimentSampleState;
}

/** Normalise a bare tool id or a {@link ProbeAction} into a ProbeAction. */
export function toProbeAction(action: string | ProbeAction): ProbeAction {
  return typeof action === "string" ? { toolId: action } : action;
}

/**
 * A stable key for a probe action within a signature map. A unary action keys on
 * the tool id alone (so legacy `distinguishable(sig, sig, ["litmus"])` still
 * resolves); a binary action includes the operand id, keeping combinations apart.
 */
export function probeActionKey(action: string | ProbeAction): string {
  const { toolId, operandId } = toProbeAction(action);
  return operandId === undefined ? toolId : `${toolId}+${operandId}`;
}

/** Compute a sample's visible signature across the given tools / probe actions. */
export function sampleSignature(
  sample: ExperimentSample,
  actions: readonly (string | ProbeAction)[],
  ruleSet: ExperimentRuleSet,
): ExperimentSignature {
  const signature: Record<string, string> = {};
  for (const raw of actions) {
    const action = toProbeAction(raw);
    signature[probeActionKey(action)] = effectEvidenceToken(
      runExperimentStep(
        sample.properties,
        action.toolId,
        ruleSet,
        action.operandState,
      ).effect,
    );
  }
  return signature;
}

/** True when two signatures differ on at least one of the given tools. */
export function distinguishable(
  a: ExperimentSignature,
  b: ExperimentSignature,
  toolIds: readonly string[],
): boolean {
  return toolIds.some((toolId) => a[toolId] !== b[toolId]);
}
