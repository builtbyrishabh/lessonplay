import type {
  SandboxLabConclusion,
  SandboxLabMission,
} from "../model/sandboxLab";
import type { ValidationResult } from "../model/scenario";
import {
  createSandboxLabSession,
  getVisibleMaterials,
  getVisibleTools,
  isConclusionUnlocked,
  reduceSandboxLabSession,
  type SandboxLabSessionState,
} from "./sandboxLabSession";

/** The outcome of driving a mission to a correct conclusion through the runtime. */
export interface SandboxLabReplayResult {
  readonly ok: boolean;
  /** Distinct evidence ids the walk actually collected. */
  readonly evidenceCollected: number;
  /** The conclusion the walk reached, or null when it never got there. */
  readonly conclusionId: string | null;
  readonly errors: string[];
}

/**
 * Every evidence id a player must hold to submit `conclusion`: the runtime gates
 * on *all* stages' `requiredEvidence` (see `hasRequiredEvidence`) as well as the
 * conclusion's own.
 */
function evidenceNeededFor(
  mission: SandboxLabMission,
  conclusion: SandboxLabConclusion,
): Set<string> {
  const needed = new Set<string>(conclusion.requiresEvidence);
  for (const stage of mission.presentation.stages) {
    for (const id of stage.requiredEvidence) needed.add(id);
  }
  return needed;
}

/**
 * The next interaction worth performing, or null when none is available here.
 *
 * The ordering is the whole subtlety. `dismissSandboxFeedback` advances the
 * stage the moment the current stage's `requiredEvidence` is complete, and a
 * later stage may not show this stage's materials and tools again. So evidence
 * that this stage can produce but does *not* require is collected FIRST, and the
 * stage's own required evidence last — otherwise clearing the stage strands
 * evidence the conclusion still needs. A player who explores before advancing
 * finds this naturally; a replay has to be explicit about it.
 */
function nextInteraction(
  state: SandboxLabSessionState,
  needed: ReadonlySet<string>,
) {
  const collected = new Set(state.collectedEvidence);
  const stage = state.mission.presentation.stages[state.currentStageIndex];
  if (!stage) return null;

  const visibleMaterials = new Set(
    getVisibleMaterials(state).map((material) => material.id),
  );
  const visibleTools = new Set(getVisibleTools(state).map((tool) => tool.id));
  const requiredHere = new Set(stage.requiredEvidence);

  const candidates = state.mission.presentation.interactions.filter(
    (interaction) =>
      visibleMaterials.has(interaction.materialId) &&
      visibleTools.has(interaction.toolId) &&
      needed.has(interaction.evidenceId) &&
      !collected.has(interaction.evidenceId),
  );

  return (
    candidates.find((i) => !requiredHere.has(i.evidenceId)) ??
    candidates[0] ??
    null
  );
}

/**
 * Play a mission to a correct conclusion through the real session reducer.
 *
 * {@link solveSandboxLabMission} proves a winning path exists by reasoning over
 * the presentation model — it is a hand-maintained mirror of the reducer, not
 * the reducer itself. This drives `reduceSandboxLabSession` directly, so
 * "solvable" and "a player can actually finish it" are held to one answer and
 * any divergence between the mirror and the machine shows up here.
 *
 * The walk is greedy and adaptive rather than a precomputed script: it re-reads
 * what is visible after every step, which is the only way to stay correct about
 * a stage index the runtime advances on its own. Each correct conclusion is
 * tried in turn, so one unreachable conclusion does not condemn the mission.
 */
export function replaySandboxLabMission(
  mission: SandboxLabMission,
): SandboxLabReplayResult {
  const correct = mission.presentation.conclusions.filter((c) => c.correct);
  if (correct.length === 0) {
    return {
      ok: false,
      evidenceCollected: 0,
      conclusionId: null,
      errors: ["the mission declares no correct conclusion, so it cannot be won"],
    };
  }

  const errors: string[] = [];
  let best: SandboxLabSessionState | null = null;

  for (const conclusion of correct) {
    const needed = evidenceNeededFor(mission, conclusion);
    let state = createSandboxLabSession(mission);

    // Every interaction is worth at most one visit; the cap is a guard against a
    // pathological mission, not a real limit on play.
    const maxSteps = mission.presentation.interactions.length + needed.size + 1;
    for (let step = 0; step < maxSteps; step++) {
      const interaction = nextInteraction(state, needed);
      if (!interaction) break;
      state = reduceSandboxLabSession(state, {
        type: "select-material",
        materialId: interaction.materialId,
      });
      state = reduceSandboxLabSession(state, {
        type: "apply-tool",
        toolId: interaction.toolId,
      });
      state = reduceSandboxLabSession(state, { type: "dismiss-feedback" });
    }

    if (best === null || state.collectedEvidence.length > best.collectedEvidence.length) {
      best = state;
    }

    if (!isConclusionUnlocked(state, conclusion)) {
      const missing = [...needed].filter(
        (id) => !state.collectedEvidence.includes(id),
      );
      errors.push(
        `conclusion "${conclusion.id}" cannot be reached: the runtime stalls in stage ${state.currentStageIndex + 1} of ${mission.presentation.stages.length} with ${describeMissing(missing)}`,
      );
      continue;
    }

    const concluded = reduceSandboxLabSession(state, {
      type: "submit-conclusion",
      conclusionId: conclusion.id,
    });
    if (concluded.phase !== "concluded") {
      errors.push(
        `conclusion "${conclusion.id}" unlocked but submitting it left the runtime in phase "${concluded.phase}" instead of "concluded"`,
      );
      continue;
    }

    return {
      ok: true,
      evidenceCollected: concluded.collectedEvidence.length,
      conclusionId: conclusion.id,
      errors: [],
    };
  }

  return {
    ok: false,
    evidenceCollected: best?.collectedEvidence.length ?? 0,
    conclusionId: null,
    errors,
  };
}

function describeMissing(missing: readonly string[]): string {
  if (missing.length === 0) return "no evidence outstanding";
  return `evidence still uncollected: ${missing.map((id) => `"${id}"`).join(", ")}`;
}

/** {@link replaySandboxLabMission} folded into the shared validation shape. */
export function replaySandboxLabMissionResult(
  mission: SandboxLabMission,
): ValidationResult {
  const { ok, errors } = replaySandboxLabMission(mission);
  return { ok, errors };
}
