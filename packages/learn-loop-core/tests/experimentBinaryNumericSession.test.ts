import { describe, expect, it } from "vitest";
import {
  createExperimentSession,
  reduceExperimentSession,
  type ExperimentSessionEvent,
  type ExperimentSessionState,
} from "../src/engine/experimentSession";
import type { ExperimentGame } from "../src/model/experimentLab";
import { displacementGame } from "./fixtures/experimentBinaryNumeric";

/**
 * Session reducer coverage for the binary + numeric primitives (issue #96):
 * a binary probe threads its operand into the notebook and de-dup key, a unary
 * probe is unchanged, and a numeric reach-target wins at the threshold.
 */

function run(
  state: ExperimentSessionState,
  events: readonly ExperimentSessionEvent[],
): ExperimentSessionState {
  return events.reduce(reduceExperimentSession, state);
}

describe("reduceExperimentSession — binary probe threads the operand", () => {
  it("records the operand on the notebook entry and de-dups on (sample, tool, operand)", () => {
    let state = run(createExperimentSession(displacementGame), [
      { type: "start-level" },
      { type: "select-sample", sampleId: "metal-x" },
      { type: "select-tool", toolId: "dip", operandId: "salt-a" },
    ]);
    expect(state.phase).toBe("observing");
    const entry = state.notebook.at(-1)!;
    expect(entry.sampleId).toBe("metal-x");
    expect(entry.operandId).toBe("salt-a");
    expect(state.lastObservation?.operandId).toBe("salt-a");

    // Re-applying the exact same (sample, tool, operand) does not duplicate.
    state = run(state, [
      { type: "dismiss-observation" },
      { type: "select-tool", toolId: "dip", operandId: "salt-a" },
    ]);
    expect(state.notebook.filter((e) => e.operandId === "salt-a").length).toBe(1);

    // A different operand is a distinct probe and is recorded separately.
    state = run(state, [
      { type: "dismiss-observation" },
      { type: "select-tool", toolId: "dip", operandId: "salt-b" },
    ]);
    expect(state.notebook.some((e) => e.operandId === "salt-b")).toBe(true);
  });
});

describe("reduceExperimentSession — unary probe is unchanged", () => {
  const unaryGame: ExperimentGame = {
    id: "unary",
    title: "",
    definition: {
      samples: [
        { id: "a", label: "A", properties: { glows: "yes" }, categoryId: "one" },
        { id: "b", label: "B", properties: { glows: "no" }, categoryId: "two" },
      ],
      tools: [{ id: "light", label: "Light" }],
      ruleSet: {
        rules: [
          {
            toolId: "light",
            when: { glows: "yes" },
            effect: { observationId: "beam", observation: "A beam glows.", visual: "beam" },
          },
        ],
        defaultEffect: { observationId: "none", observation: "No beam.", visual: "none" },
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
        toolIds: ["light"],
        goal: { classifyIds: ["a", "b"], categoryIds: ["one", "two"] },
        scaffolding: "guided",
        predictionRequired: false,
        hints: [],
      },
    ],
  };

  it("applies a unary tool with no operand exactly as before", () => {
    const state = run(createExperimentSession(unaryGame), [
      { type: "start-level" },
      { type: "select-sample", sampleId: "a" },
      { type: "select-tool", toolId: "light" },
    ]);
    const entry = state.notebook.at(-1)!;
    expect(entry.toolId).toBe("light");
    expect(entry.operandId).toBeUndefined();
    expect(entry.visual).toBe("beam");
  });
});

describe("reduceExperimentSession — numeric reach-target wins at the threshold", () => {
  const neutralise: ExperimentGame = {
    id: "neutralise",
    title: "",
    definition: {
      samples: [{ id: "acid", label: "Acid", properties: { ph: 2 }, categoryId: "x" }],
      tools: [{ id: "add-base", label: "Add base" }],
      ruleSet: {
        rules: [
          {
            toolId: "add-base",
            when: {},
            effect: {
              observationId: "warms",
              observation: "The beaker warms slightly.",
              visual: "temperature",
              addState: { ph: 3 },
            },
          },
        ],
        defaultEffect: { observationId: "n", observation: "nothing.", visual: "none" },
      },
    },
    categories: [{ id: "x", label: "X" }],
    levels: [
      {
        id: "make-neutral",
        title: "",
        intro: "",
        sampleIds: ["acid"],
        toolIds: ["add-base"],
        goal: {
          kind: "reach-target-state",
          sampleId: "acid",
          target: {},
          numericTarget: { ph: { op: ">=", value: 7 } },
          targetLabel: "Bring it to neutral",
        },
        scaffolding: "hinted",
        predictionRequired: false,
        hints: [],
      },
    ],
  };

  it("stays exploring below the threshold and reveals once it is crossed", () => {
    // First dose: ph 2 → 5, still below 7 → back to exploring, not won.
    let state = run(createExperimentSession(neutralise), [
      { type: "start-level" },
      { type: "select-tool", toolId: "add-base" },
      { type: "dismiss-observation" },
    ]);
    expect(state.sampleStates.acid.ph).toBe(5);
    expect(state.phase).toBe("exploring");

    // Second dose: ph 5 → 8, now ≥ 7 → the goal is met and the level reveals.
    state = run(state, [
      { type: "select-tool", toolId: "add-base" },
      { type: "dismiss-observation" },
    ]);
    expect(state.sampleStates.acid.ph).toBe(8);
    expect(state.phase).toBe("revealed");
  });
});
