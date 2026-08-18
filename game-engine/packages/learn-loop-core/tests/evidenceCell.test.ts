import { describe, expect, it } from "vitest";
import {
  evidenceCellDisplay,
  EMPTY_CELL,
  VISUAL_CELL,
} from "../src/ui/evidenceCell";

describe("evidenceCellDisplay", () => {
  it("returns the empty marker (no colour-only signal) for no reading", () => {
    for (const reading of [null, undefined]) {
      const cell = evidenceCellDisplay(reading);
      expect(cell.value).toBe(EMPTY_CELL);
      expect(cell.cls).toBe("gcell--empty");
      expect(cell.empty).toBe(true);
    }
  });

  it("prefers the structured readout value — the actual datum", () => {
    const cell = evidenceCellDisplay({
      visual: "ph-scale",
      readout: { value: "pH 2" },
    });
    expect(cell.value).toBe("pH 2");
    expect(cell.cls).toBe("gcell--ph");
    expect(cell.empty).toBe(false);
  });

  it("keeps the unit on a measure reading (the datum the learner reads off)", () => {
    const cell = evidenceCellDisplay({
      visual: "measure",
      readout: { value: "50", unit: "g" },
    });
    expect(cell.value).toBe("50 g");
    expect(cell.cls).toBe("gcell--measure");
  });

  it("shows a measure value bare when it carries no unit", () => {
    const cell = evidenceCellDisplay({ visual: "measure", readout: { value: "7" } });
    expect(cell.value).toBe("7");
  });

  it("does not append a unit for non-measure readouts", () => {
    // A unit on a non-measure readout is ignored — only measure reads a number.
    const cell = evidenceCellDisplay({
      visual: "ph-scale",
      readout: { value: "2", unit: "pH" },
    });
    expect(cell.value).toBe("2");
  });

  it("uses the gas token when there is no readout", () => {
    const cell = evidenceCellDisplay({ visual: "gas", gasLabel: "H₂" });
    expect(cell.value).toBe("H₂");
    expect(cell.cls).toBe("gcell--gas");
  });

  it("falls back to the per-visual word when neither readout nor gas exists", () => {
    const cell = evidenceCellDisplay({ visual: "beam" });
    expect(cell.value).toBe("beam");
    expect(cell.cls).toBe("gcell--beam");
  });

  it("prefers readout over gas token when both are present", () => {
    const cell = evidenceCellDisplay({
      visual: "gas",
      gasLabel: "H₂",
      readout: { value: "on" },
    });
    expect(cell.value).toBe("on");
  });

  it("always yields non-empty text for every visual (text always present)", () => {
    for (const visual of Object.keys(VISUAL_CELL) as (keyof typeof VISUAL_CELL)[]) {
      const cell = evidenceCellDisplay({ visual });
      expect(cell.value.length).toBeGreaterThan(0);
      expect(cell.value).toBe(VISUAL_CELL[visual].label);
      expect(cell.cls).toBe(VISUAL_CELL[visual].cls);
    }
  });
});
