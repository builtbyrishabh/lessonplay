import { describe, expect, it } from "vitest";
import {
  applyStateDelta,
  evaluateComparison,
  matchesNumericWhen,
  ruleMatches,
  runExperimentSequence,
  runExperimentStep,
} from "../src/engine/experimentRules";
import type { ExperimentRule } from "../src/model/experimentLab";
import { particleExperiment } from "./fixtures/experimentParticles";
import {
  ironCopperBench,
  saturationRuleSet,
} from "./fixtures/experimentBinaryNumeric";

/**
 * Rule engine coverage for the binary + numeric primitives (issue #96). Every
 * block pairs the new behaviour with a "legacy still works" assertion so the
 * unary/categorical path is proven unchanged.
 */

describe("evaluateComparison — numeric thresholds and ranges", () => {
  it("compares against a literal value with every operator", () => {
    const s = { n: 5 };
    expect(evaluateComparison(5, { op: ">=", value: 5 }, s)).toBe(true);
    expect(evaluateComparison(5, { op: ">", value: 5 }, s)).toBe(false);
    expect(evaluateComparison(5, { op: "<=", value: 5 }, s)).toBe(true);
    expect(evaluateComparison(5, { op: "<", value: 6 }, s)).toBe(true);
    expect(evaluateComparison(5, { op: "==", value: 5 }, s)).toBe(true);
  });

  it("compares against another property of the same sample", () => {
    const s = { dissolved: 30, saturationPoint: 30 };
    expect(
      evaluateComparison(30, { op: ">=", property: "saturationPoint" }, s),
    ).toBe(true);
    expect(
      evaluateComparison(20, { op: "<", property: "saturationPoint" }, s),
    ).toBe(true);
  });

  it("honours inclusive range bounds", () => {
    const s = {};
    expect(evaluateComparison(30, { min: 30, max: 70 }, s)).toBe(true);
    expect(evaluateComparison(70, { min: 30, max: 70 }, s)).toBe(true);
    expect(evaluateComparison(29, { min: 30, max: 70 }, s)).toBe(false);
    expect(evaluateComparison(71, { min: 30, max: 70 }, s)).toBe(false);
  });

  it("fails closed on a missing or non-numeric operand", () => {
    expect(evaluateComparison(undefined, { op: ">=", value: 1 }, {})).toBe(false);
    expect(evaluateComparison("hot", { op: ">=", value: 1 }, {})).toBe(false);
    expect(
      evaluateComparison(5, { op: ">=", property: "missing" }, { n: 5 }),
    ).toBe(false);
  });
});

describe("matchesNumericWhen", () => {
  it("passes when absent (legacy rules have no numericWhen)", () => {
    expect(matchesNumericWhen({ nature: "acid" }, undefined)).toBe(true);
  });

  it("requires every comparison to hold", () => {
    const state = { mass: 50, ph: 7 };
    expect(
      matchesNumericWhen(state, { mass: { op: ">=", value: 40 }, ph: { op: "==", value: 7 } }),
    ).toBe(true);
    expect(
      matchesNumericWhen(state, { mass: { op: ">=", value: 40 }, ph: { op: "==", value: 2 } }),
    ).toBe(false);
  });
});

describe("ruleMatches — operand constraints", () => {
  const rule: ExperimentRule = {
    toolId: "dip",
    when: { reactivity: "high" },
    whenOperand: { solution: "copper-salt" },
    effect: { observationId: "x", observation: "", visual: "none" },
  };

  it("matches when both the sample and the operand satisfy their constraints", () => {
    expect(
      ruleMatches(rule, { reactivity: "high" }, { solution: "copper-salt" }),
    ).toBe(true);
  });

  it("does not match a different operand", () => {
    expect(ruleMatches(rule, { reactivity: "high" }, { solution: "water" })).toBe(
      false,
    );
  });

  it("never matches a unary application (no operand supplied)", () => {
    expect(ruleMatches(rule, { reactivity: "high" })).toBe(false);
  });
});

describe("applyStateDelta — set replaces, add accumulates", () => {
  it("returns the same reference when there is nothing to change", () => {
    const s = { a: "1" };
    expect(applyStateDelta(s)).toBe(s);
  });

  it("replaces via setState and adds via addState (missing base is 0)", () => {
    expect(applyStateDelta({ dissolved: 10 }, { phase: "wet" }, { dissolved: 10 })).toEqual({
      dissolved: 20,
      phase: "wet",
    });
    expect(applyStateDelta({}, undefined, { count: 3 })).toEqual({ count: 3 });
  });
});

describe("runExperimentStep — binary application", () => {
  it("returns the operand-dependent effect and a merged operand state", () => {
    const iron = ironCopperBench.samples.find((s) => s.id === "iron")!;
    const copperSulfate = ironCopperBench.reagents!.find(
      (r) => r.id === "copper-sulfate",
    )!;
    const result = runExperimentStep(
      iron.properties,
      "dip",
      ironCopperBench.ruleSet,
      copperSulfate.properties,
    );
    expect(result.effect.observationId).toBe("iron-deposit");
    expect(result.matched).toBe(true);
    expect(result.nextState.coated).toBe("yes");
    // An operand state was supplied, so a next operand state is returned.
    expect(result.nextOperandState).toEqual(copperSulfate.properties);
  });

  it("gives a different outcome for the same tool with a different operand", () => {
    const iron = ironCopperBench.samples.find((s) => s.id === "iron")!;
    const water = ironCopperBench.reagents!.find((r) => r.id === "water")!;
    const result = runExperimentStep(
      iron.properties,
      "dip",
      ironCopperBench.ruleSet,
      water.properties,
    );
    expect(result.effect.observationId).toBe("no-change");
    expect(result.matched).toBe(false);
    expect(result.nextState.coated).toBeUndefined();
  });
});

describe("runExperimentSequence — numeric accumulation to a saturation point", () => {
  it("dissolves until dissolved reaches saturationPoint, then settles", () => {
    const start = { dissolved: 0, saturationPoint: 30 };
    const { results, finalState } = runExperimentSequence(
      start,
      ["add-solute", "add-solute", "add-solute", "add-solute", "add-solute"],
      saturationRuleSet,
    );
    // First three spoons dissolve (0→10→20→30).
    expect(results.slice(0, 3).map((r) => r.effect.observationId)).toEqual([
      "dissolves",
      "dissolves",
      "dissolves",
    ]);
    // Once dissolved hits the point, further spoons no longer dissolve.
    expect(results[3].effect.observationId).toBe("no-more-dissolves");
    expect(results[3].effect.visual).toBe("settle");
    expect(results[4].effect.observationId).toBe("no-more-dissolves");
    expect(finalState.dissolved).toBe(30);
  });
});

describe("legacy unary/categorical path is unchanged", () => {
  const { ruleSet, samples } = particleExperiment;
  const sample = (id: string) => samples.find((s) => s.id === id)!;

  it("runs a unary tool with no operand exactly as before", () => {
    const result = runExperimentStep(sample("unknown-b").properties, "light", ruleSet);
    expect(result.effect.observationId).toBe("light-beam-gritty");
    expect(result.effect.visual).toBe("beam");
    expect(result.matched).toBe(true);
    expect(result.nextOperandState).toBeUndefined();
  });

  it("threads a bare-string tool sequence unchanged", () => {
    const { results } = runExperimentSequence(
      sample("unknown-b").properties,
      ["light", "settle"],
      ruleSet,
    );
    expect(results.map((r) => r.effect.visual)).toEqual(["beam", "settle"]);
  });
});
