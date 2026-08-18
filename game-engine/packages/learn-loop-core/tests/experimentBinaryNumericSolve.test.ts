import { describe, expect, it } from "vitest";
import { solveExperiment } from "../src/engine/solveExperiment";
import type {
  ExperimentDefinition,
  ExperimentLevel,
} from "../src/model/experimentLab";
import {
  displacementBench,
  displacementGame,
  numericMeasureBench,
  numericMeasureGame,
} from "./fixtures/experimentBinaryNumeric";
import { particleExperiment } from "./fixtures/experimentParticles";

/**
 * Analyzer coverage for the binary + numeric primitives (issue #96): a level
 * winnable only by combining operands is winnable; a level whose only
 * discriminator is a measured number is winnable; brute-force and rail checks
 * still fire; and a legacy classify verdict is byte-identical.
 */

describe("solveExperiment — binary 'combine causes'", () => {
  const level = displacementGame.levels[0];

  it("proves a level winnable only by combining two dips", () => {
    const analysis = solveExperiment(displacementBench, level);
    expect(analysis.winnable).toBe(true);
    expect(analysis.railed).toBe(false);
    expect(analysis.bruteForceable).toBe(false);
    expect(analysis.indistinguishablePairs).toEqual([]);
    // Neither dip alone separates all three categories; both are needed.
    expect(analysis.toolsNeeded).toBe(2);
  });

  it("rails a binary level when a single operand already separates every category", () => {
    // Offer only salt A: metal-x and metal-y both react with A and become
    // indistinguishable, so the level is no longer winnable.
    const oneReagent: ExperimentDefinition = {
      ...displacementBench,
      reagents: displacementBench.reagents!.filter((r) => r.id === "salt-a"),
    };
    const analysis = solveExperiment(oneReagent, level);
    expect(analysis.winnable).toBe(false);
    expect(analysis.indistinguishablePairs).toContainEqual(["metal-x", "metal-y"]);
  });
});

describe("solveExperiment — numeric reading as the only discriminator", () => {
  it("proves a level winnable where a pair differs only in the measured number", () => {
    const analysis = solveExperiment(numericMeasureBench, numericMeasureGame.levels[0]);
    expect(analysis.winnable).toBe(true);
    expect(analysis.railed).toBe(false);
    expect(analysis.bruteForceable).toBe(false);
    expect(analysis.toolsNeeded).toBe(2);
  });
});

describe("solveExperiment — cheats still rejected with the new primitives", () => {
  it("flags a binary level as railed when one dip separates everything", () => {
    // A two-category world where salt A alone tells the metals apart → railed.
    const bench: ExperimentDefinition = {
      samples: [
        { id: "m1", label: "M1", properties: { reactsWithA: "yes" }, categoryId: "reactive" },
        { id: "m2", label: "M2", properties: { reactsWithA: "no" }, categoryId: "inert" },
      ],
      reagents: [{ id: "salt-a", label: "A", properties: { salt: "A" } }],
      tools: [{ id: "dip", label: "Dip", operand: { kind: "reagent" } }],
      ruleSet: {
        rules: [
          {
            toolId: "dip",
            when: { reactsWithA: "yes" },
            whenOperand: { salt: "A" },
            effect: { observationId: "dep", observation: "coats over.", visual: "color-change", readout: { kind: "color", value: "reddish" } },
          },
        ],
        defaultEffect: { observationId: "none", observation: "unchanged.", visual: "none" },
      },
    };
    const level: ExperimentLevel = {
      id: "one-dip",
      title: "",
      intro: "",
      sampleIds: ["m1", "m2"],
      toolIds: ["dip"],
      goal: { classifyIds: ["m1", "m2"], categoryIds: ["reactive", "inert"] },
      scaffolding: "open",
      predictionRequired: false,
      hints: [],
    };
    const analysis = solveExperiment(bench, level);
    expect(analysis.railed).toBe(true);
  });
});

describe("solveExperiment — legacy classify verdict is unchanged", () => {
  it("gives the same verdict for the particle bench as before the change", () => {
    const level: ExperimentLevel = {
      id: "legacy",
      title: "",
      intro: "",
      sampleIds: ["unknown-a", "unknown-b", "unknown-c", "control"],
      toolIds: ["light", "settle", "filter"],
      goal: {
        classifyIds: ["unknown-a", "unknown-b", "unknown-c"],
        categoryIds: ["solution", "suspension", "colloid"],
      },
      scaffolding: "open",
      predictionRequired: false,
      hints: [],
    };
    const analysis = solveExperiment(particleExperiment, level);
    expect(analysis.winnable).toBe(true);
    expect(analysis.railed).toBe(false);
    expect(analysis.bruteForceable).toBe(false);
    // "combine causes": no single tool separates all three particle categories.
    expect(analysis.toolsNeeded).toBeGreaterThan(1);
  });
});
