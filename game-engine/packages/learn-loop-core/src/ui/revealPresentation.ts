/**
 * The pure reveal-presentation model for {@link ExperimentLabViewport}.
 *
 * This is the "aha moment" made data. The viewport's win screen is the emotional
 * climax of every ExperimentLab game — the concept the game deliberately withheld
 * is finally granted — but the goal-kind branching that decides *what* is revealed
 * and *in what order* has no business living inside JSX. This module lifts it out:
 * given a level's {@link ExperimentGoal} plus the session's revealed state, it
 * returns a normalized, goal-kind-agnostic {@link RevealPresentation} — an ordered
 * list of {@link RevealBeat}s and a crediting headline — so the viewport becomes a
 * shallow shell that only stages and styles the beats.
 *
 * React-free and deterministic: the same inputs always yield the same beats in the
 * same order (so a replay feels identical). It is the primary unit under test; the
 * staging animation and finale are pure CSS presentation and are not modelled here.
 *
 * Everything is derived from *existing* authored data — sample labels/revealLabels,
 * category labels/definitions, the prediction score, the target label — so no new
 * field is added to the game contract to power the upgraded payoff.
 */

import {
  experimentGoalKind,
  isClassifyGoal,
  isPredictOutcomeGoal,
  isReachTargetStateGoal,
  type ExperimentCategory,
  type ExperimentGoal,
  type ExperimentGoalKind,
  type ExperimentSample,
} from "../model/experimentLab";

/**
 * One revealed sample in a classify payoff, in the declared `classifyIds` order.
 * The withheld concept (`categoryLabel`) is the trophy granted last within the
 * beat; `revealLabel` (the real-world identity) and `definition` (the payoff line)
 * are optional and degrade cleanly to `null` when the author left them out.
 */
export interface ClassifyRevealBeat {
  readonly kind: "classify";
  /** Stable key for rendering (the sample id). */
  readonly id: string;
  /** Public, learner-facing label such as `"Unknown X"`. */
  readonly sampleLabel: string;
  /** Real-world identity for the reveal (e.g. `"chalk water"`), or null. */
  readonly revealLabel: string | null;
  /** The withheld concept name granted as the reward (e.g. `"Suspension"`). */
  readonly categoryLabel: string;
  /** One-line definition shown last, beneath the concept, or null. */
  readonly definition: string | null;
}

/** The score payoff for a predict-outcome level. `perfect` flags a clean sweep. */
export interface PredictOutcomeRevealBeat {
  readonly kind: "predict-outcome";
  readonly correct: number;
  readonly total: number;
  /** True when every prediction was right (and at least one was made). */
  readonly perfect: boolean;
}

/** The completed-transformation payoff for a reach-target-state level. */
export interface ReachTargetRevealBeat {
  readonly kind: "reach-target-state";
  /** The learner-facing goal label (e.g. `"Make it neutral"`), or null. */
  readonly targetLabel: string | null;
}

/** A single staged unit of the reveal; the viewport renders these in order. */
export type RevealBeat =
  | ClassifyRevealBeat
  | PredictOutcomeRevealBeat
  | ReachTargetRevealBeat;

/**
 * The normalized, goal-kind-agnostic payoff the viewport renders: a crediting
 * headline plus the ordered beats. `goalKind` lets the shell pick markup/styling
 * without re-deriving it. `isLastLevel` drives the "Finish" vs "Next case" action.
 */
export interface RevealPresentation {
  readonly goalKind: ExperimentGoalKind;
  /** Credits the learner's reasoning ("You cracked it"), never a graded "correct". */
  readonly headline: string;
  readonly beats: readonly RevealBeat[];
  readonly isLastLevel: boolean;
}

/** The revealed session facts the presentation needs, all already-authored data. */
export interface RevealSessionState {
  /** Look up a sample by id (the viewport already keeps this map). */
  readonly sampleById: ReadonlyMap<string, ExperimentSample>;
  /** predict-outcome tally: correct predictions out of the prompt count. */
  readonly predictionScore: { readonly correct: number; readonly total: number };
  /** reach-target-state learner-facing goal label, else null. */
  readonly targetLabel: string | null;
  /** True when this is the final level (drives the finish vs next headline/action). */
  readonly isLastLevel: boolean;
}

/** Coerce an optional/blank authored string to a clean `string | null`. */
function optional(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Build the classify beats in the declared `classifyIds` order. Each beat pairs the
 * withheld concept (from the sample's `categoryId`) with the sample's public label,
 * its optional real-world reveal label, and the concept's optional definition.
 * Samples the world no longer knows about (a stale id) are skipped, so the beats
 * always correspond to something renderable.
 */
function classifyBeats(
  classifyIds: readonly string[],
  session: RevealSessionState,
  categoryById: ReadonlyMap<string, ExperimentCategory>,
): ClassifyRevealBeat[] {
  const beats: ClassifyRevealBeat[] = [];
  for (const id of classifyIds) {
    const sample = session.sampleById.get(id);
    if (!sample) continue;
    const category = categoryById.get(sample.categoryId);
    beats.push({
      kind: "classify",
      id: sample.id,
      sampleLabel: sample.label,
      revealLabel: optional(sample.revealLabel),
      // The concept label falls back to the raw category id if the author never
      // named it, so the trophy slot is never empty text.
      categoryLabel: optional(category?.label) ?? sample.categoryId,
      definition: optional(category?.definition),
    });
  }
  return beats;
}

/**
 * The crediting headline. It celebrates the learner's *reasoning* rather than a
 * generic "Right!"/"correct", and a perfect predict-outcome run gets its own,
 * distinctly stronger line so a clean sweep feels rewarded.
 */
function headlineFor(
  goalKind: ExperimentGoalKind,
  beats: readonly RevealBeat[],
): string {
  switch (goalKind) {
    case "predict-outcome": {
      const beat = beats[0];
      if (beat && beat.kind === "predict-outcome" && beat.perfect) {
        return "Every call, right.";
      }
      return "You read the reactions.";
    }
    case "reach-target-state":
      return "You made it happen.";
    case "classify":
    default:
      return "You cracked it.";
  }
}

/**
 * Derive the staged reveal payoff for a level from its goal and the revealed
 * session state — the single, tested source of truth for what the win screen shows.
 *
 * @param goal        the level's win condition (any of the three kinds)
 * @param categories  the game's categories (for concept labels + definitions)
 * @param session     the revealed session facts (all already-authored data)
 */
export function buildRevealPresentation(
  goal: ExperimentGoal,
  categories: readonly ExperimentCategory[],
  session: RevealSessionState,
): RevealPresentation {
  const goalKind = experimentGoalKind(goal);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  let beats: RevealBeat[];
  if (isClassifyGoal(goal)) {
    beats = classifyBeats(goal.classifyIds, session, categoryById);
  } else if (isPredictOutcomeGoal(goal)) {
    const { correct, total } = session.predictionScore;
    beats = [
      {
        kind: "predict-outcome",
        correct,
        total,
        perfect: total > 0 && correct === total,
      },
    ];
  } else if (isReachTargetStateGoal(goal)) {
    beats = [
      {
        kind: "reach-target-state",
        targetLabel: optional(session.targetLabel ?? undefined),
      },
    ];
  } else {
    beats = [];
  }

  return {
    goalKind,
    headline: headlineFor(goalKind, beats),
    beats,
    isLastLevel: session.isLastLevel,
  };
}
