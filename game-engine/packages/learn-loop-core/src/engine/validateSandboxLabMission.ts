import type { SandboxLabMission } from "../model/sandboxLab";
import { validateSandboxLabPresentation } from "../model/sandboxLab";
import type { ValidationResult } from "../model/scenario";
import { replaySandboxLabMission } from "./replaySandboxLab";
import { solveSandboxLabMission } from "./solveSandboxLabMission";

/**
 * The single build-time gate for a SandboxLab mission, in three stages that run
 * strictly in order because each only makes sense on top of the last:
 *
 *   1. structural — referential integrity, shape, the investigation contract;
 *   2. solvability — {@link solveSandboxLabMission} proves a winning path exists;
 *   3. replay — {@link replaySandboxLabMission} walks that path through the real
 *      session reducer and submits a correct conclusion.
 *
 * Each stage's errors are returned alone. Solvability is meaningless on
 * incoherent data, and replaying a mission already known to have no winning path
 * would only restate the solver's finding less clearly — so a caller surfacing
 * these to a generating agent always gets causes before symptoms.
 *
 * Stage 3 is what makes "completable" a fact rather than an inference. The
 * solver is a hand-maintained mirror of `sandboxLabSession`, and a mirror can
 * drift; only the reducer decides what a learner can actually finish.
 */
export function validateSandboxLabMission(
  mission: SandboxLabMission,
): ValidationResult {
  const structural = validateSandboxLabPresentation(
    mission.scenario,
    mission.presentation,
  );
  if (!structural.ok) {
    return structural;
  }

  const solved = solveSandboxLabMission(mission);
  if (!solved.solvable) {
    return { ok: false, errors: solved.errors };
  }

  const replayed = replaySandboxLabMission(mission);
  return { ok: replayed.ok, errors: replayed.errors };
}
