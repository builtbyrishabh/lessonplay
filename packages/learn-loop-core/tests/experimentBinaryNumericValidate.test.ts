import { describe, expect, it } from "vitest";
import {
  validateExperimentGame,
  validateExperimentMission,
} from "../src/engine/validateExperimentGame";
import type { ExperimentGame } from "../src/model/experimentLab";
import {
  displacementGame,
  numericMeasureGame,
} from "./fixtures/experimentBinaryNumeric";
import { acidsBasesSaltsGame } from "./fixtures/experimentAcidsBasesSalts";

/**
 * Validator coverage for the binary + numeric primitives (issue #96): the new
 * structural checks reject inert binary tools, dangling operands, and dead
 * numeric rules, while well-formed binary/numeric games and every existing
 * fixture keep validating.
 */

const hasError = (game: ExperimentGame, needle: string) =>
  validateExperimentGame(game).errors.some((e) => e.includes(needle));

describe("validateExperimentGame — binary structural checks", () => {
  it("rejects a reagent-binary tool offered with no reagent shelf", () => {
    const game: ExperimentGame = {
      id: "g",
      title: "",
      definition: {
        samples: [
          { id: "a", label: "A", properties: { k: "x" }, categoryId: "one" },
          { id: "b", label: "B", properties: { k: "y" }, categoryId: "two" },
        ],
        tools: [{ id: "mix", label: "Mix", operand: { kind: "reagent" } }],
        ruleSet: {
          rules: [],
          defaultEffect: { observationId: "n", observation: "nothing.", visual: "none" },
        },
      },
      categories: [
        { id: "one", label: "One" },
        { id: "two", label: "Two" },
      ],
      levels: [
        {
          id: "l",
          title: "",
          intro: "",
          sampleIds: ["a", "b"],
          toolIds: ["mix"],
          goal: { classifyIds: ["a", "b"], categoryIds: ["one", "two"] },
          scaffolding: "open",
          predictionRequired: false,
          hints: [],
        },
      ],
    };
    expect(hasError(game, "no reagent shelf")).toBe(true);
  });

  it("rejects a sample-binary tool with fewer than two samples on the bench", () => {
    const game: ExperimentGame = {
      id: "g",
      title: "",
      definition: {
        samples: [{ id: "a", label: "A", properties: { k: "x" }, categoryId: "one" }],
        tools: [{ id: "combine", label: "Combine", operand: { kind: "sample" } }],
        ruleSet: {
          rules: [],
          defaultEffect: { observationId: "n", observation: "nothing.", visual: "none" },
        },
      },
      categories: [{ id: "one", label: "One" }],
      levels: [
        {
          id: "l",
          title: "",
          intro: "",
          sampleIds: ["a"],
          toolIds: ["combine"],
          goal: { classifyIds: ["a"], categoryIds: ["one"] },
          scaffolding: "guided",
          predictionRequired: false,
          hints: [],
        },
      ],
    };
    expect(hasError(game, "fewer than two samples")).toBe(true);
  });

  it("rejects a rule that constrains an operand for a non-binary tool", () => {
    const game: ExperimentGame = {
      id: "g",
      title: "",
      definition: {
        samples: [{ id: "a", label: "A", properties: { k: "x" }, categoryId: "one" }],
        tools: [{ id: "look", label: "Look" }],
        ruleSet: {
          rules: [
            {
              toolId: "look",
              when: {},
              whenOperand: { k: "x" },
              effect: { observationId: "o", observation: "seen.", visual: "none" },
            },
          ],
          defaultEffect: { observationId: "n", observation: "nothing.", visual: "none" },
        },
      },
      categories: [{ id: "one", label: "One" }],
      levels: [],
    };
    expect(hasError(game, "is not binary")).toBe(true);
  });
});

describe("validateExperimentGame — numeric structural checks", () => {
  const numericGame = (numericWhen: Record<string, unknown>): ExperimentGame => ({
    id: "g",
    title: "",
    definition: {
      samples: [{ id: "a", label: "A", properties: { mass: 10 }, categoryId: "one" }],
      tools: [{ id: "weigh", label: "Weigh" }],
      ruleSet: {
        rules: [
          {
            toolId: "weigh",
            when: {},
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            numericWhen: numericWhen as any,
            effect: { observationId: "o", observation: "reading.", visual: "measure" },
          },
        ],
        defaultEffect: { observationId: "n", observation: "nothing.", visual: "none" },
      },
    },
    categories: [{ id: "one", label: "One" }],
    levels: [],
  });

  it("rejects a numeric comparison on a property that is never numeric (dead rule)", () => {
    expect(hasError(numericGame({ volume: { op: ">=", value: 5 } }), "can never be satisfied")).toBe(
      true,
    );
  });

  it("rejects an unsatisfiable range (min > max)", () => {
    expect(hasError(numericGame({ mass: { min: 90, max: 10 } }), "unsatisfiable")).toBe(true);
  });

  it("accepts a satisfiable numeric comparison on a declared numeric property", () => {
    expect(hasError(numericGame({ mass: { op: ">=", value: 5 } }), "can never be satisfied")).toBe(
      false,
    );
  });
});

describe("validateExperimentGame — operand references in prompts", () => {
  it("rejects a binary predict-outcome prompt with an unresolved operand", () => {
    const game: ExperimentGame = {
      id: "g",
      title: "",
      definition: {
        samples: [{ id: "a", label: "A", properties: { k: "x" }, categoryId: "one" }],
        reagents: [{ id: "r", label: "R", properties: { s: "1" } }],
        tools: [{ id: "mix", label: "Mix", operand: { kind: "reagent" } }],
        ruleSet: {
          rules: [],
          defaultEffect: { observationId: "n", observation: "fizzes.", visual: "fizz" },
        },
      },
      categories: [{ id: "one", label: "One" }],
      levels: [
        {
          id: "l",
          title: "",
          intro: "",
          sampleIds: ["a"],
          toolIds: ["mix"],
          goal: {
            kind: "predict-outcome",
            prompts: [{ sampleId: "a", toolId: "mix", operandId: "ghost" }],
          },
          scaffolding: "guided",
          predictionRequired: false,
          hints: [],
        },
      ],
    };
    expect(hasError(game, "neither a sample nor a shelf reagent")).toBe(true);
  });
});

describe("well-formed binary/numeric games and legacy fixtures pass the gate", () => {
  it("accepts the displacement (binary) game end-to-end", () => {
    expect(validateExperimentMission(displacementGame)).toEqual({ ok: true, errors: [] });
  });

  it("accepts the numeric-measure game end-to-end", () => {
    expect(validateExperimentMission(numericMeasureGame)).toEqual({ ok: true, errors: [] });
  });

  it("still accepts the existing acids/bases/salts fixture unchanged", () => {
    expect(validateExperimentMission(acidsBasesSaltsGame)).toEqual({ ok: true, errors: [] });
  });
});
