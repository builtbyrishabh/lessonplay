import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  Icon,
  getIconGlyph,
  ICON_REGISTRY,
  FALLBACK_ICON_ID,
} from "../src/ui/icons";

describe("Icon component + registry", () => {
  it("renders a known id's mapped glyph with its accessible label", () => {
    const { container, getByRole } = render(
      <Icon id="objective" label="Objective" />,
    );
    const svg = getByRole("img", { name: "Objective" });
    expect(svg).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveClass("xl-icon");
  });

  it("hides the icon from assistive tech when it is decorative (beside text)", () => {
    const { container } = render(<Icon id="light" decorative />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // No accessible name when decorative, even if beside a visible label.
    expect(svg).not.toHaveAttribute("aria-label");
  });

  it("treats a label-less icon as decorative (aria-hidden)", () => {
    const { container } = render(<Icon id="hint" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("falls back safely for an unknown id (renders the generic glyph, no throw)", () => {
    const unknown = () => render(<Icon id="totally-made-up-tool" label="Tool" />);
    expect(unknown).not.toThrow();
    // The resolver returns the generic glyph for any unknown id.
    expect(getIconGlyph("totally-made-up-tool")).toBe(
      ICON_REGISTRY[FALLBACK_ICON_ID],
    );
    // And a known id resolves to its own glyph, not the fallback.
    expect(getIconGlyph("magnet")).toBe(ICON_REGISTRY.magnet);
  });

  it("resolves every previously-emoji tool + semantic id to a real glyph", () => {
    const ids = [
      // tools (formerly TOOL_ICON)
      "light",
      "settle",
      "filter",
      "heat",
      "stir",
      "acid",
      "base",
      "litmus",
      "water",
      "magnet",
      "limewater",
      "flame",
      "evaporate",
      // semantic chrome
      "objective",
      "hint",
      "verdict-correct",
      "verdict-wrong",
      "complete",
    ];
    for (const id of ids) {
      expect(ICON_REGISTRY[id]).toBeDefined();
      // Each id renders without throwing.
      expect(() => render(<Icon id={id} decorative />)).not.toThrow();
    }
  });
});
