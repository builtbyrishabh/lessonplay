import { describe, expect, it } from "vitest";
import type {
  SandboxLabInteraction,
  SandboxLabMission,
} from "../src/model/sandboxLab";
import { replaySandboxLabMission } from "../src/engine/replaySandboxLab";
import { validateSandboxLabMission } from "../src/engine/validateSandboxLabMission";
import { acidBaseScenario } from "./fixtures/acidBase";
import { sandboxIndicatorMission } from "./fixtures/sandboxIndicator";
import { sandboxSaltSandMission } from "./fixtures/sandboxMixtures";

/** A minimal interaction; only the fields the reducer and replay read matter. */
function interaction(
  id: string,
  materialId: string,
  toolId: string,
  evidenceId: string,
): SandboxLabInteraction {
  return {
    id,
    materialId,
    toolId,
    evidenceId,
    feedbackCard: {
      action: `You used ${toolId}.`,
      result: "Something happens.",
      why: "Because of the reagent.",
      next: "Record it.",
      notebook: `${materialId} + ${toolId}.`,
    },
    soundCue: "pour",
    reactionEffect: "color-change",
  };
}

/**
 * Two stages where stage 1 can produce evidence it does not itself require, and
 * stage 2 never shows stage 1's material again. Clearing stage 1 first strands
 * "extra" permanently — the ordering trap the replay has to avoid.
 */
const strandingMission: SandboxLabMission = {
  scenario: acidBaseScenario,
  presentation: {
    scenarioId: acidBaseScenario.id,
    mode: "investigation",
    badge: "Ordering",
    question: "Can the walk collect the optional evidence before advancing?",
    materials: [
      { id: "m1", label: "Sample One", stationId: "beaker" },
      { id: "m2", label: "Sample Two", stationId: "beaker" },
    ],
    tools: [
      { id: "t1", label: "Tool One", action: { type: "pour", reagent: "distilled-water" } },
      { id: "t2", label: "Tool Two", action: { type: "pour", reagent: "sodium-hydroxide" } },
      { id: "t3", label: "Tool Three", action: { type: "pour", reagent: "distilled-water" } },
    ],
    interactions: [
      interaction("i-extra", "m1", "t1", "extra"),
      interaction("i-req1", "m1", "t2", "req1"),
      interaction("i-req2", "m2", "t3", "req2"),
    ],
    stages: [
      {
        id: "stage-one",
        title: "Stage one",
        goal: "Clear stage one.",
        materialIds: ["m1"],
        toolIds: ["t1", "t2"],
        requiredEvidence: ["req1"],
        nextPrompt: "Move on when stage one is clear.",
      },
      {
        id: "stage-two",
        title: "Stage two",
        goal: "Clear stage two.",
        materialIds: ["m2"],
        toolIds: ["t3"],
        requiredEvidence: ["req2"],
        nextPrompt: "Draw your conclusion.",
      },
    ],
    conclusions: [
      {
        id: "correct",
        label: "The right call.",
        correct: true,
        requiresEvidence: ["extra", "req1", "req2"],
        feedback: "Correct.",
      },
    ],
    notebook: { goal: "Finish both stages.", hints: [], explanation: "Done." },
    stationVisuals: [{ stationId: "beaker", kind: "beaker", label: "Beaker" }],
    completionMessage: "Done.",
  },
};

describe("replaySandboxLabMission", () => {
  it.each([
    ["sandboxIndicatorMission", sandboxIndicatorMission],
    ["sandboxSaltSandMission", sandboxSaltSandMission],
    ["strandingMission", strandingMission],
  ])("plays %s to a correct conclusion", (_name, mission) => {
    const result = replaySandboxLabMission(mission);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.conclusionId).not.toBeNull();
  });

  it("collects stage evidence the stage does not require before clearing it", () => {
    // The runtime advances the stage as soon as its requiredEvidence is
    // complete, so collecting "req1" first would strand "extra" for good.
    const result = replaySandboxLabMission(strandingMission);
    expect(result).toMatchObject({ ok: true, evidenceCollected: 3 });
  });

  it("reports the stage it stalls in when evidence is genuinely unreachable", () => {
    const unreachable: SandboxLabMission = {
      ...strandingMission,
      presentation: {
        ...strandingMission.presentation,
        // Nothing produces "ghost", so the conclusion can never unlock.
        conclusions: [
          {
            id: "correct",
            label: "The right call.",
            correct: true,
            requiresEvidence: ["req1", "ghost"],
            feedback: "Correct.",
          },
        ],
      },
    };
    const result = replaySandboxLabMission(unreachable);

    expect(result.ok).toBe(false);
    expect(result.conclusionId).toBeNull();
    expect(result.errors.join(" ")).toContain('"ghost"');
    expect(result.errors.join(" ")).toContain("stalls in stage");
  });

  it("reports a mission with no correct conclusion", () => {
    const noWin: SandboxLabMission = {
      ...strandingMission,
      presentation: {
        ...strandingMission.presentation,
        conclusions: [
          {
            id: "wrong",
            label: "Not it.",
            correct: false,
            requiresEvidence: [],
            feedback: "No.",
          },
        ],
      },
    };
    expect(replaySandboxLabMission(noWin)).toMatchObject({
      ok: false,
      conclusionId: null,
    });
  });
});

describe("validateSandboxLabMission — replay stage", () => {
  it("passes the shipped fixtures through all three stages", () => {
    expect(validateSandboxLabMission(sandboxIndicatorMission)).toEqual({
      ok: true,
      errors: [],
    });
    expect(validateSandboxLabMission(sandboxSaltSandMission)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("returns structural errors alone, without running the later stages", () => {
    const broken: SandboxLabMission = {
      ...sandboxIndicatorMission,
      presentation: {
        ...sandboxIndicatorMission.presentation,
        scenarioId: "not-the-scenario",
      },
    };
    const result = validateSandboxLabMission(broken);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("must match scenario");
    expect(result.errors.join(" ")).not.toContain("stalls in stage");
  });
});
