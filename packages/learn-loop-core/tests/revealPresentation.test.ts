import { describe, expect, it } from "vitest";
import {
  buildRevealPresentation,
  type RevealSessionState,
} from "../src/ui/revealPresentation";
import type {
  ExperimentCategory,
  ExperimentGoal,
  ExperimentSample,
} from "../src/model/experimentLab";

/**
 * Pure unit tests for the reveal-presentation model — the tested source of truth
 * for the "aha moment" payoff. These assert the returned data (beats, their order,
 * per-goal-kind fields, and the crediting headline), never CSS/keyframes/delays,
 * which are presentation verified by visual QA. Style mirrors the pure goal tests.
 */

function sample(
  id: string,
  categoryId: string,
  extra: Partial<ExperimentSample> = {},
): ExperimentSample {
  return {
    id,
    label: `Unknown ${id.toUpperCase()}`,
    properties: {},
    categoryId,
    ...extra,
  };
}

function sessionOver(
  samples: readonly ExperimentSample[],
  overrides: Partial<RevealSessionState> = {},
): RevealSessionState {
  return {
    sampleById: new Map(samples.map((s) => [s.id, s])),
    predictionScore: { correct: 0, total: 0 },
    targetLabel: null,
    isLastLevel: false,
    ...overrides,
  };
}

const categories: readonly ExperimentCategory[] = [
  { id: "solution", label: "Solution", definition: "Particles too small to see." },
  { id: "suspension", label: "Suspension", definition: "Large particles settle out." },
  { id: "colloid", label: "Colloid" }, // no definition → degrades cleanly
];

describe("buildRevealPresentation — classify", () => {
  it("yields one beat per classify id in the declared order, with concept + reveal + definition", () => {
    const samples = [
      sample("a", "suspension", { label: "Bottle A", revealLabel: "chalk water" }),
      sample("b", "solution", { label: "Bottle B", revealLabel: "salt water" }),
    ];
    const goal: ExperimentGoal = {
      // Declared order is B then A — the beats must follow it, not sample order.
      classifyIds: ["b", "a"],
      categoryIds: ["solution", "suspension"],
    };

    const reveal = buildRevealPresentation(goal, categories, sessionOver(samples));

    expect(reveal.goalKind).toBe("classify");
    expect(reveal.headline).toBe("You cracked it.");
    expect(reveal.beats.map((b) => (b.kind === "classify" ? b.id : b.kind))).toEqual([
      "b",
      "a",
    ]);

    const [first, second] = reveal.beats;
    expect(first).toMatchObject({
      kind: "classify",
      id: "b",
      sampleLabel: "Bottle B",
      revealLabel: "salt water",
      categoryLabel: "Solution",
      definition: "Particles too small to see.",
    });
    expect(second).toMatchObject({
      kind: "classify",
      id: "a",
      sampleLabel: "Bottle A",
      revealLabel: "chalk water",
      categoryLabel: "Suspension",
      definition: "Large particles settle out.",
    });
  });

  it("degrades cleanly when a reveal label or a definition is absent (→ null)", () => {
    const samples = [
      // No revealLabel on the sample; colloid category has no definition.
      sample("c", "colloid", { label: "Bottle C" }),
    ];
    const goal: ExperimentGoal = {
      classifyIds: ["c"],
      categoryIds: ["colloid"],
    };

    const [beat] = buildRevealPresentation(goal, categories, sessionOver(samples))
      .beats;

    expect(beat).toMatchObject({
      kind: "classify",
      categoryLabel: "Colloid",
      revealLabel: null,
      definition: null,
    });
  });

  it("treats a blank reveal label / definition as absent", () => {
    const samples = [sample("d", "blank", { label: "Bottle D", revealLabel: "   " })];
    const cats: readonly ExperimentCategory[] = [
      { id: "blank", label: "Mystery", definition: "  " },
    ];
    const goal: ExperimentGoal = { classifyIds: ["d"], categoryIds: ["blank"] };

    const [beat] = buildRevealPresentation(goal, cats, sessionOver(samples)).beats;

    expect(beat).toMatchObject({ revealLabel: null, definition: null });
  });

  it("falls back to the raw category id when the concept has no authored label", () => {
    const samples = [sample("e", "orphan", { label: "Bottle E" })];
    const goal: ExperimentGoal = { classifyIds: ["e"], categoryIds: ["orphan"] };

    const [beat] = buildRevealPresentation(goal, [], sessionOver(samples)).beats;

    expect(beat).toMatchObject({ kind: "classify", categoryLabel: "orphan" });
  });

  it("falls back to the raw category id when the authored concept label is blank", () => {
    const samples = [sample("g", "blank-label", { label: "Bottle G" })];
    const cats: readonly ExperimentCategory[] = [
      { id: "blank-label", label: "   ", definition: "A valid definition." },
    ];
    const goal: ExperimentGoal = {
      classifyIds: ["g"],
      categoryIds: ["blank-label"],
    };

    const [beat] = buildRevealPresentation(goal, cats, sessionOver(samples))
      .beats;

    expect(beat).toMatchObject({
      kind: "classify",
      categoryLabel: "blank-label",
      definition: "A valid definition.",
    });
  });

  it("skips a stale classify id that no longer maps to a sample", () => {
    const samples = [sample("f", "solution", { label: "Bottle F" })];
    const goal: ExperimentGoal = {
      classifyIds: ["ghost", "f"],
      categoryIds: ["solution"],
    };

    const reveal = buildRevealPresentation(goal, categories, sessionOver(samples));

    expect(reveal.beats).toHaveLength(1);
    expect(reveal.beats[0]).toMatchObject({ id: "f" });
  });

  it("handles 2–5 categories and a variable number of samples", () => {
    const cats: readonly ExperimentCategory[] = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      label: `Cat ${i}`,
    }));
    const samples = Array.from({ length: 4 }, (_, i) =>
      sample(`s${i}`, `c${i % 5}`, { label: `S${i}` }),
    );
    const goal: ExperimentGoal = {
      classifyIds: samples.map((s) => s.id),
      categoryIds: cats.map((c) => c.id),
    };

    const reveal = buildRevealPresentation(goal, cats, sessionOver(samples));

    expect(reveal.beats).toHaveLength(4);
    expect(reveal.beats.every((b) => b.kind === "classify")).toBe(true);
  });
});

describe("buildRevealPresentation — predict-outcome", () => {
  it("carries the correct/total counts and flags a non-perfect run", () => {
    const goal: ExperimentGoal = {
      kind: "predict-outcome",
      prompts: [
        { sampleId: "a", toolId: "t" },
        { sampleId: "b", toolId: "t" },
      ],
    };
    const reveal = buildRevealPresentation(
      goal,
      categories,
      sessionOver([], { predictionScore: { correct: 1, total: 2 } }),
    );

    expect(reveal.goalKind).toBe("predict-outcome");
    expect(reveal.headline).toBe("You read the reactions.");
    expect(reveal.beats).toHaveLength(1);
    expect(reveal.beats[0]).toMatchObject({
      kind: "predict-outcome",
      correct: 1,
      total: 2,
      perfect: false,
    });
  });

  it("flags a perfect run and gives it a distinct headline", () => {
    const goal: ExperimentGoal = {
      kind: "predict-outcome",
      prompts: [{ sampleId: "a", toolId: "t" }],
    };
    const reveal = buildRevealPresentation(
      goal,
      categories,
      sessionOver([], { predictionScore: { correct: 2, total: 2 } }),
    );

    expect(reveal.beats[0]).toMatchObject({ perfect: true, correct: 2, total: 2 });
    expect(reveal.headline).toBe("Every call, right.");
  });

  it("is not perfect when no prediction was made (0 of 0)", () => {
    const goal: ExperimentGoal = { kind: "predict-outcome", prompts: [] };
    const reveal = buildRevealPresentation(
      goal,
      categories,
      sessionOver([], { predictionScore: { correct: 0, total: 0 } }),
    );

    expect(reveal.beats[0]).toMatchObject({ perfect: false });
    expect(reveal.headline).toBe("You read the reactions.");
  });
});

describe("buildRevealPresentation — reach-target-state", () => {
  it("carries the target label and credits the transformation", () => {
    const goal: ExperimentGoal = {
      kind: "reach-target-state",
      sampleId: "acid",
      target: { nature: "neutral" },
      targetLabel: "Make it neutral",
    };
    const reveal = buildRevealPresentation(
      goal,
      categories,
      sessionOver([], { targetLabel: "Make it neutral" }),
    );

    expect(reveal.goalKind).toBe("reach-target-state");
    expect(reveal.headline).toBe("You made it happen.");
    expect(reveal.beats).toHaveLength(1);
    expect(reveal.beats[0]).toMatchObject({
      kind: "reach-target-state",
      targetLabel: "Make it neutral",
    });
  });

  it("degrades a missing/blank target label to null", () => {
    const goal: ExperimentGoal = {
      kind: "reach-target-state",
      sampleId: "acid",
      target: { nature: "neutral" },
      targetLabel: "Make it neutral",
    };
    const reveal = buildRevealPresentation(
      goal,
      categories,
      sessionOver([], { targetLabel: "  " }),
    );

    expect(reveal.beats[0]).toMatchObject({
      kind: "reach-target-state",
      targetLabel: null,
    });
  });
});

describe("buildRevealPresentation — level position", () => {
  it("passes through isLastLevel so the shell can pick Finish vs Next", () => {
    const goal: ExperimentGoal = { classifyIds: [], categoryIds: [] };
    expect(
      buildRevealPresentation(goal, categories, sessionOver([], { isLastLevel: true }))
        .isLastLevel,
    ).toBe(true);
    expect(
      buildRevealPresentation(goal, categories, sessionOver([], { isLastLevel: false }))
        .isLastLevel,
    ).toBe(false);
  });

  it("is deterministic: identical inputs produce identical beats", () => {
    const samples = [
      sample("a", "suspension", { label: "A", revealLabel: "chalk water" }),
      sample("b", "solution", { label: "B", revealLabel: "salt water" }),
    ];
    const goal: ExperimentGoal = {
      classifyIds: ["a", "b"],
      categoryIds: ["solution", "suspension"],
    };
    const first = buildRevealPresentation(goal, categories, sessionOver(samples));
    const second = buildRevealPresentation(goal, categories, sessionOver(samples));

    expect(first).toEqual(second);
  });
});
