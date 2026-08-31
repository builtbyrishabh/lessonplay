import { describe, expect, it } from "vitest";
import { matchesWhen, runExperimentStep } from "../src/engine/experimentRules";
import { validateExperimentGame } from "../src/engine/validateExperimentGame";
import type { ExperimentGame, ExperimentRule } from "../src/model/experimentLab";
import { particleGame } from "./fixtures/experimentParticles";

/**
 * Model-authored data can leave `when` out of a rule (a rule gated only by
 * `numericWhen` is the usual case). That must be a validation error with a
 * fix in it, never a TypeError from inside the analyzer.
 */
describe("a rule with no `when`", () => {
  // What the model actually wrote — bypasses the type on purpose.
  const noWhen = {
    toolId: "light",
    effect: { observationId: "glow", observation: "A faint glow.", visual: "beam" },
  } as unknown as ExperimentRule;

  const withRule = (): ExperimentGame => ({
    ...particleGame,
    definition: {
      ...particleGame.definition,
      ruleSet: {
        ...particleGame.definition.ruleSet,
        rules: [noWhen, ...particleGame.definition.ruleSet.rules],
      },
    },
  });

  it("matches any state instead of throwing", () => {
    expect(matchesWhen({ particleSize: "fine" }, undefined)).toBe(true);
    const sample = particleGame.definition.samples[0]!;
    expect(() =>
      runExperimentStep(sample.properties, "light", withRule().definition.ruleSet),
    ).not.toThrow();
  });

  it("is reported by the structural validator with the fix", () => {
    const result = validateExperimentGame(withRule());
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('rule for tool "light" (observation "glow") has no `when`'),
    );
    expect(result.errors[0]).toContain("when: {}");
  });
});
