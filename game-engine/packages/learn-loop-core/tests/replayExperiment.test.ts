import { describe, expect, it } from "vitest";
import type {
  ExperimentGame,
  ExperimentLevel,
} from "../src/model/experimentLab";
import { replayExperimentGame } from "../src/engine/replayExperiment";
import { solveExperiment } from "../src/engine/solveExperiment";
import { validateExperimentMission } from "../src/engine/validateExperimentGame";
import {
  transformBench,
  transformCategories,
} from "./fixtures/experimentTransform";
import { acidsBasesSaltsGame } from "./fixtures/experimentAcidsBasesSalts";
import { particleGame } from "./fixtures/experimentParticles";
import {
  displacementGame,
  numericMeasureGame,
} from "./fixtures/experimentBinaryNumeric";

function gameWith(...levels: ExperimentLevel[]): ExperimentGame {
  return {
    id: "transform-test",
    title: "Transform test",
    definition: transformBench,
    categories: transformCategories,
    levels,
  };
}

const baseLevel = {
  id: "lvl",
  title: "Level",
  intro: "",
  scaffolding: "open" as const,
  predictionRequired: false,
  hints: [],
};

// ---------------------------------------------------------------------------
// A winning path exists and is shaped for the reducer
// ---------------------------------------------------------------------------

describe("solveExperiment — winningPath", () => {
  it("gives a classify level a path that ends in a submitted classification", () => {
    const level: ExperimentLevel = {
      ...baseLevel,
      sampleIds: ["acid-x", "base-y"],
      toolIds: ["litmus", "add-base"],
      goal: {
        kind: "classify",
        classifyIds: ["acid-x", "base-y"],
        categoryIds: ["acid", "base"],
      },
    };
    const { winningPath } = solveExperiment(transformBench, level);

    expect(winningPath[0]).toEqual({ type: "start-level" });
    expect(winningPath.at(-1)).toEqual({ type: "submit-classification" });
    // Every sample that must be classified is probed, which is what opens the
    // evidence gate, and each is assigned its true category.
    expect(winningPath).toContainEqual({
      type: "assign-category",
      sampleId: "acid-x",
      categoryId: "acid",
    });
  });

  it("leaves the path empty when the level is not winnable", () => {
    // Zinc reacts only with an acid, so a base and a neutral both fall through
    // to the default effect: same evidence, different categories.
    const level: ExperimentLevel = {
      ...baseLevel,
      sampleIds: ["base-y", "neutral-z"],
      toolIds: ["zinc"],
      goal: {
        kind: "classify",
        classifyIds: ["base-y", "neutral-z"],
        categoryIds: ["base", "neutral"],
      },
    };
    const analysis = solveExperiment(transformBench, level);

    expect(analysis.winnable).toBe(false);
    expect(analysis.indistinguishablePairs).toEqual([["base-y", "neutral-z"]]);
    expect(analysis.winningPath).toEqual([]);
  });

  it("omits a prediction when the level does not require one", () => {
    const level: ExperimentLevel = {
      ...baseLevel,
      sampleIds: ["acid-x", "base-y"],
      toolIds: ["litmus", "add-base"],
      goal: {
        kind: "classify",
        classifyIds: ["acid-x", "base-y"],
        categoryIds: ["acid", "base"],
      },
    };
    const { winningPath } = solveExperiment(transformBench, level);
    expect(winningPath.some((e) => e.type === "predict")).toBe(false);
  });

  it("predicts before every probe when the level requires it", () => {
    const level: ExperimentLevel = {
      ...baseLevel,
      predictionRequired: true,
      sampleIds: ["acid-x", "base-y"],
      toolIds: ["litmus", "add-base"],
      goal: {
        kind: "classify",
        classifyIds: ["acid-x", "base-y"],
        categoryIds: ["acid", "base"],
      },
    };
    const { winningPath } = solveExperiment(transformBench, level);
    expect(winningPath.filter((e) => e.type === "predict")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// The path actually drives the runtime to a win — every goal kind
// ---------------------------------------------------------------------------

describe("replayExperimentGame — goal kinds", () => {
  it("completes a classify game", () => {
    const game = gameWith({
      ...baseLevel,
      sampleIds: ["acid-x", "base-y"],
      toolIds: ["litmus", "add-base"],
      goal: {
        kind: "classify",
        classifyIds: ["acid-x", "base-y"],
        categoryIds: ["acid", "base"],
      },
    });
    expect(replayExperimentGame(game)).toEqual({
      ok: true,
      levelsCompleted: 1,
      errors: [],
    });
  });

  it("completes a predict-outcome game by answering every prompt", () => {
    const game = gameWith({
      ...baseLevel,
      sampleIds: ["acid-x", "neutral-z"],
      toolIds: ["zinc"],
      goal: {
        kind: "predict-outcome",
        prompts: [
          { sampleId: "acid-x", toolId: "zinc" },
          { sampleId: "neutral-z", toolId: "zinc" },
        ],
      },
    });
    expect(replayExperimentGame(game)).toEqual({
      ok: true,
      levelsCompleted: 1,
      errors: [],
    });
  });

  it("completes a reach-target-state game by walking the shortest path", () => {
    const game = gameWith({
      ...baseLevel,
      sampleIds: ["acid-x"],
      toolIds: ["litmus", "add-base"],
      goal: {
        kind: "reach-target-state",
        sampleId: "acid-x",
        target: { nature: "neutral" },
        targetLabel: "Make it neutral",
      },
    });
    expect(replayExperimentGame(game)).toEqual({
      ok: true,
      levelsCompleted: 1,
      errors: [],
    });
  });

  it("walks a multi-level ladder in order and ends complete", () => {
    const game = gameWith(
      {
        ...baseLevel,
        id: "one",
        sampleIds: ["acid-x", "base-y"],
        toolIds: ["litmus", "add-base"],
        goal: {
          kind: "classify",
          classifyIds: ["acid-x", "base-y"],
          categoryIds: ["acid", "base"],
        },
      },
      {
        ...baseLevel,
        id: "two",
        sampleIds: ["acid-x"],
        toolIds: ["litmus", "add-base"],
        goal: {
          kind: "reach-target-state",
          sampleId: "acid-x",
          target: { nature: "neutral" },
          targetLabel: "Make it neutral",
        },
      },
    );
    expect(replayExperimentGame(game)).toEqual({
      ok: true,
      levelsCompleted: 2,
      errors: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Failure reporting
// ---------------------------------------------------------------------------

describe("replayExperimentGame — failures", () => {
  it("reports a game with no levels rather than throwing", () => {
    expect(replayExperimentGame(gameWith())).toEqual({
      ok: false,
      levelsCompleted: 0,
      errors: ["the game has no levels"],
    });
  });

  it("names the level when a level has no winning path", () => {
    const game = gameWith({
      ...baseLevel,
      id: "unwinnable",
      sampleIds: ["base-y", "neutral-z"],
      toolIds: ["zinc"],
      goal: {
        kind: "classify",
        classifyIds: ["base-y", "neutral-z"],
        categoryIds: ["base", "neutral"],
      },
    });
    const result = replayExperimentGame(game);

    expect(result.ok).toBe(false);
    expect(result.levelsCompleted).toBe(0);
    expect(result.errors[0]).toContain('level "unwinnable"');
  });

  it("stops at the first unwinnable level and keeps the count of those cleared", () => {
    const game = gameWith(
      {
        ...baseLevel,
        id: "fine",
        sampleIds: ["acid-x", "base-y"],
        toolIds: ["litmus", "add-base"],
        goal: {
          kind: "classify",
          classifyIds: ["acid-x", "base-y"],
          categoryIds: ["acid", "base"],
        },
      },
      {
        ...baseLevel,
        id: "broken",
        sampleIds: ["base-y", "neutral-z"],
        toolIds: ["zinc"],
        goal: {
          kind: "classify",
          classifyIds: ["base-y", "neutral-z"],
          categoryIds: ["base", "neutral"],
        },
      },
    );
    const result = replayExperimentGame(game);

    expect(result.ok).toBe(false);
    expect(result.levelsCompleted).toBe(1);
    expect(result.errors.join(" ")).toContain('level "broken"');
  });
});

// ---------------------------------------------------------------------------
// The gate runs structural -> quality -> replay, and every shipped fixture
// survives all three.
// ---------------------------------------------------------------------------

describe("validateExperimentMission — replay stage", () => {
  it.each([
    ["acidsBasesSaltsGame", acidsBasesSaltsGame],
    ["particleGame", particleGame],
    ["displacementGame", displacementGame],
    ["numericMeasureGame", numericMeasureGame],
  ])("plays %s through to completion", (_name, game) => {
    expect(validateExperimentMission(game)).toEqual({ ok: true, errors: [] });
    expect(replayExperimentGame(game)).toMatchObject({
      ok: true,
      levelsCompleted: game.levels.length,
    });
  });

  it("returns structural errors alone, without running the later stages", () => {
    const game = gameWith({
      ...baseLevel,
      sampleIds: ["ghost"],
      toolIds: ["litmus"],
      goal: { kind: "classify", classifyIds: ["ghost"], categoryIds: ["acid"] },
    });
    const result = validateExperimentMission(game);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown sample");
    // A replay error would mean the gate ran a later stage on incoherent data.
    expect(result.errors.join(" ")).not.toContain("not completable");
  });
});
