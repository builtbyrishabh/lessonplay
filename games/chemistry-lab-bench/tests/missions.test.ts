import { describe, expect, it } from "vitest";
import {
  applyAction,
  validateSandboxLabMission,
  validateScenario,
  type Workspace,
} from "@learn-loop/core";

import { chemistryLabTemplate, indicatorMission } from "../src/content/missions";

describe("ChemQuest starter mission", () => {
  it("contains one minimal mission rather than a collection of finished games", () => {
    expect(chemistryLabTemplate.missions).toEqual([indicatorMission]);
  });

  it("passes the shared structural and solvability gates", () => {
    expect(validateScenario(indicatorMission.scenario)).toEqual({ ok: true, errors: [] });
    expect(validateSandboxLabMission(indicatorMission)).toEqual({ ok: true, errors: [] });
  });

  it("reaches the expected visible state through the shared engine", () => {
    const { scenario } = indicatorMission;
    const workspace: Workspace = { stations: structuredClone(scenario.stations) };
    const result = applyAction(
      workspace,
      { type: "pour", reagent: "sodium-hydroxide", target: "unknown" },
      scenario.rules,
      scenario.entities,
    );

    expect(result.result.visibleChange).toBe(true);
    expect(result.workspace.stations.unknown.color).toBe("#e8508f");
    expect(result.workspace.stations.unknown.heat).toBe("warm");
  });
});
