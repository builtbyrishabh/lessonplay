import type { ExperimentGame } from "../model/experimentLab";
import type { ValidationResult } from "../model/scenario";
import {
  createExperimentSession,
  reduceExperimentSession,
  type ExperimentSessionEvent,
  type ExperimentSessionState,
} from "./experimentSession";
import { solveExperiment } from "./solveExperiment";

/**
 * The outcome of driving a whole game through its own runtime.
 *
 * `levelsCompleted` counts levels actually cleared, so a partial walk still
 * says how far a learner would get before being stuck.
 */
export interface ExperimentReplayResult {
  readonly ok: boolean;
  readonly levelsCompleted: number;
  readonly errors: string[];
}

/** A short, readable rendering of an event, for error messages. */
function describeEvent(event: ExperimentSessionEvent): string {
  switch (event.type) {
    case "select-sample":
      return `select-sample "${event.sampleId}"`;
    case "select-tool":
      return event.operandId === undefined
        ? `select-tool "${event.toolId}"`
        : `select-tool "${event.toolId}" + "${event.operandId}"`;
    case "predict":
      return `predict "${event.visual}"`;
    case "assign-category":
      return `assign-category "${event.sampleId}" -> "${event.categoryId}"`;
    default:
      return event.type;
  }
}

/**
 * Play a game to completion through the real session reducer.
 *
 * {@link solveExperiment} proves a level is winnable by reasoning over the rule
 * layer. That is a claim about the *rules*, not about the machine a learner
 * actually drives: the reducer adds phases, the evidence gate on classifying,
 * prompt walks, and per-level win conditions on top. This walks each level's
 * `winningPath` through `reduceExperimentSession` and requires every level to
 * land in `revealed` and the game to end in `complete` — so "the analyzer found
 * a path" and "a player can finish this" are held to the same answer.
 *
 * The reducer returns the *same object* for an event it refuses, and a fresh one
 * for every event it accepts, so reference equality pins a failure to the exact
 * event and phase where the walk stalled rather than reporting a bare
 * "never finished".
 *
 * Assumes levels are individually winnable (run {@link solveExperiment} first);
 * a level with no winning path is reported rather than thrown.
 */
export function replayExperimentGame(
  game: ExperimentGame,
): ExperimentReplayResult {
  const errors: string[] = [];

  if (game.levels.length === 0) {
    return { ok: false, levelsCompleted: 0, errors: ["the game has no levels"] };
  }

  let state: ExperimentSessionState = createExperimentSession(game);
  let levelsCompleted = 0;

  for (const level of game.levels) {
    const { winningPath } = solveExperiment(game.definition, level);
    if (winningPath.length === 0) {
      errors.push(
        `level "${level.id}" has no winning path to replay, so it cannot be shown to be completable`,
      );
      break;
    }

    let stalled = false;
    for (const [index, event] of winningPath.entries()) {
      const next = reduceExperimentSession(state, event);
      if (next === state) {
        errors.push(
          `level "${level.id}" is not completable: the runtime refused ${describeEvent(event)} (step ${index + 1} of ${winningPath.length}) while in phase "${state.phase}"`,
        );
        stalled = true;
        break;
      }
      state = next;
    }
    if (stalled) break;

    if (state.phase !== "revealed") {
      errors.push(
        `level "${level.id}" is not completable: its winning path ran to the end but left the runtime in phase "${state.phase}" instead of "revealed"`,
      );
      break;
    }

    levelsCompleted += 1;
    state = reduceExperimentSession(state, { type: "next-level" });
  }

  if (errors.length === 0 && state.phase !== "complete") {
    errors.push(
      `every level was cleared but the game ended in phase "${state.phase}" instead of "complete"`,
    );
  }

  return { ok: errors.length === 0, levelsCompleted, errors };
}

/** {@link replayExperimentGame} folded into the shared validation shape. */
export function replayExperimentGameResult(
  game: ExperimentGame,
): ValidationResult {
  const { ok, errors } = replayExperimentGame(game);
  return { ok, errors };
}
