import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExperimentLabViewport } from "../src/ui/ExperimentLabViewport";
import type { ExperimentGame } from "../src/model/experimentLab";

/**
 * A minimal one-level, no-prediction game so the smoke test drives the actual
 * observe-and-record flow the viewport renders: pick a sample, apply a tool, see
 * the reading land in the grid, then classify through to the reveal.
 */
const smokeGame: ExperimentGame = {
  id: "smoke",
  title: "Smoke Lab",
  definition: {
    samples: [
      { id: "control", label: "Water control", properties: { size: "tiny" }, categoryId: "control" },
      {
        id: "unknown-x",
        label: "Unknown X",
        properties: { size: "coarse" },
        categoryId: "suspension",
        revealLabel: "chalk water",
      },
    ],
    tools: [
      { id: "light", label: "Side light" },
      { id: "filter", label: "Filter" },
    ],
    ruleSet: {
      rules: [
        {
          toolId: "light",
          when: { size: "coarse" },
          effect: {
            observationId: "beam",
            observation: "A beam path glows across the liquid.",
            visual: "beam",
          },
        },
        {
          toolId: "filter",
          when: { size: "coarse" },
          effect: {
            observationId: "residue",
            observation: "Residue stays on the paper.",
            visual: "residue",
          },
        },
      ],
      defaultEffect: {
        observationId: "none",
        observation: "Nothing happens.",
        visual: "none",
      },
    },
  },
  categories: [
    { id: "control", label: "Control" },
    { id: "solution", label: "Solution" },
    { id: "suspension", label: "Suspension", definition: "Large particles settle out." },
    { id: "colloid", label: "Colloid" },
  ],
  levels: [
    {
      id: "only",
      title: "Find the unknown",
      intro: "Test the unknown and make the call.",
      outro: "Nicely done.",
      sampleIds: ["control", "unknown-x"],
      toolIds: ["light", "filter"],
      goal: {
        classifyIds: ["unknown-x"],
        categoryIds: ["solution", "suspension", "colloid"],
      },
      scaffolding: "open",
      predictionRequired: false,
      hints: [],
    },
  ],
};

describe("ExperimentLabViewport", () => {
  it("renders the dark-glow shell and applies the theme classes", () => {
    const { container } = render(
      <ExperimentLabViewport game={smokeGame} theme={{ accent: "violet" }} />,
    );

    const root = container.querySelector(".experiment-lab-app");
    expect(root).not.toBeNull();
    expect(root?.className).toContain("xl-accent-violet");
    // Unknown/omitted tokens fall back to the dark-glow default.
    expect(root?.className).toContain("xl-palette-night-lab");
    expect(screen.getByText("Smoke Lab")).toBeInTheDocument();
  });

  it("draws the Tyndall lamp only for games that use the beam visual", () => {
    // Smoke Lab scatters light, so the side lamp is real apparatus.
    const { container: withBeam } = render(
      <ExperimentLabViewport game={smokeGame} />,
    );
    expect(withBeam.querySelector(".lamp")).not.toBeNull();

    // A bench with no beam anywhere must not show a stray lamp box.
    const noBeam: ExperimentGame = {
      ...smokeGame,
      definition: {
        ...smokeGame.definition,
        ruleSet: {
          ...smokeGame.definition.ruleSet,
          rules: smokeGame.definition.ruleSet.rules.map((rule) => ({
            ...rule,
            effect: { ...rule.effect, visual: "none" as const },
          })),
          defaultEffect: {
            ...smokeGame.definition.ruleSet.defaultEffect,
            visual: "none" as const,
          },
        },
      },
    };
    const { container: withoutBeam } = render(
      <ExperimentLabViewport game={noBeam} />,
    );
    expect(withoutBeam.querySelector(".lamp")).toBeNull();
  });

  it("drives a probe into the grid and a correct call through to the reveal", async () => {
    const user = userEvent.setup();
    render(<ExperimentLabViewport game={smokeGame} />);

    // Intro overlay → enter the lab.
    await user.click(screen.getByRole("button", { name: "Enter the lab" }));

    // Select the unknown from the notebook rows, then apply the side light.
    const notebook = screen.getByRole("region", { name: "Lab notebook" });
    await user.click(within(notebook).getByRole("button", { name: /Unknown X/ }));
    const tools = screen.getByRole("region", { name: "Tools" });
    await user.click(within(tools).getByRole("button", { name: /Side light/ }));

    // The reading is recorded into the notebook grid immediately.
    const grid = screen.getByRole("region", { name: "Lab notebook" });
    expect(within(grid).getByText("beam")).toBeInTheDocument();

    // The evidence gate is met, so the call's label flips immediately, but it
    // stays disabled while the effect lingers and only re-enables once the bench
    // reopens (the observe beat).
    const makeCall = screen.getByRole("button", { name: "Make the call" });
    await waitFor(() => expect(makeCall).toBeEnabled(), { timeout: 3000 });
    await user.click(makeCall);
    await user.click(screen.getByRole("button", { name: "Suspension" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    // Correct classification reveals the identity and the concept, under a
    // headline that credits the learner's reasoning (not a generic "Right!").
    expect(
      screen.getByRole("heading", { name: "You cracked it." }),
    ).toBeInTheDocument();
    expect(screen.getByText("chalk water")).toBeInTheDocument();
    // The withheld concept name is granted as the reward.
    const revealRegion = screen.getByLabelText("Reveal");
    expect(within(revealRegion).getByText("Suspension")).toBeInTheDocument();
  });

  it("runs the predict beat on a prediction-required level before the effect plays", async () => {
    const user = userEvent.setup();
    // Same world, but this level demands a prediction before each tool fires.
    const predictGame: ExperimentGame = {
      ...smokeGame,
      levels: [{ ...smokeGame.levels[0], predictionRequired: true }],
    };
    render(<ExperimentLabViewport game={predictGame} />);

    await user.click(screen.getByRole("button", { name: "Enter the lab" }));
    const notebook = screen.getByRole("region", { name: "Lab notebook" });
    await user.click(within(notebook).getByRole("button", { name: /Unknown X/ }));
    const tools = screen.getByRole("region", { name: "Tools" });
    await user.click(within(tools).getByRole("button", { name: /Side light/ }));

    // The tool does not fire yet — the predict overlay asks first, offering the
    // effects the light can show (a beam) versus nothing.
    expect(
      screen.getByRole("heading", { name: "Predict first" }),
    ).toBeInTheDocument();
    const grid = screen.getByRole("region", { name: "Lab notebook" });
    expect(within(grid).queryByText("beam")).toBeNull();

    // Predicting "a beam" applies the tool, records the reading, and reconciles.
    await user.click(screen.getByRole("button", { name: "A beam lights up" }));
    expect(within(grid).getByText("beam")).toBeInTheDocument();
    expect(screen.getByText(/You called it/)).toBeInTheDocument();
  });

  it("plays a gas effect: records a 'gas' reading and shows the gas chip", async () => {
    const user = userEvent.setup();
    // A metal + acid world: the acid tool evolves a gas off the reactive sample.
    const gasGame: ExperimentGame = {
      id: "gas",
      title: "Acid Bench",
      definition: {
        samples: [
          { id: "inert", label: "Inert chip", properties: { reactive: "no" }, categoryId: "unreactive" },
          {
            id: "metal",
            label: "Mystery metal",
            properties: { reactive: "yes" },
            categoryId: "reactive",
            revealLabel: "zinc",
          },
        ],
        tools: [{ id: "acid", label: "Add dilute acid" }],
        ruleSet: {
          rules: [
            {
              toolId: "acid",
              when: { reactive: "yes" },
              effect: {
                observationId: "bubbles",
                observation: "Bubbles stream off the metal and a gas escapes.",
                visual: "gas",
                gasLabel: "H₂",
              },
            },
          ],
          defaultEffect: {
            observationId: "still",
            observation: "Nothing happens.",
            visual: "none",
          },
        },
      },
      categories: [
        { id: "unreactive", label: "Unreactive" },
        { id: "reactive", label: "Reactive", definition: "Gives off hydrogen with acid." },
      ],
      levels: [
        {
          id: "only",
          title: "Which one reacts?",
          intro: "Add acid and watch.",
          outro: "That gas was hydrogen.",
          sampleIds: ["inert", "metal"],
          toolIds: ["acid"],
          goal: { classifyIds: ["metal"], categoryIds: ["unreactive", "reactive"] },
          scaffolding: "open",
          predictionRequired: false,
          hints: [],
        },
      ],
    };
    render(<ExperimentLabViewport game={gasGame} />);

    await user.click(screen.getByRole("button", { name: "Enter the lab" }));
    const notebook = screen.getByRole("region", { name: "Lab notebook" });
    await user.click(within(notebook).getByRole("button", { name: /Mystery metal/ }));
    const tools = screen.getByRole("region", { name: "Tools" });
    await user.click(within(tools).getByRole("button", { name: /Add dilute acid/ }));

    // The gas chip rides above the beaker while the effect plays, and the
    // notebook records the actual gas token (real evidence, not a generic label).
    expect(screen.getAllByText(/H₂/).length).toBeGreaterThanOrEqual(1);
    const grid = screen.getByRole("region", { name: "Lab notebook" });
    expect(within(grid).getByText("H₂")).toBeInTheDocument();
  });

  it("plays a predict-outcome level as a guided prompt walk with a score", async () => {
    const user = userEvent.setup();
    // Two prompts on the acid world: acid reacts (gas), inert does not (none).
    const predictOutcomeGame: ExperimentGame = {
      id: "predict",
      title: "Call the Reaction",
      definition: {
        samples: [
          { id: "inert", label: "Chip", properties: { reactive: "no" }, categoryId: "unreactive" },
          { id: "metal", label: "Metal", properties: { reactive: "yes" }, categoryId: "reactive" },
        ],
        tools: [{ id: "acid", label: "Add dilute acid" }],
        ruleSet: {
          rules: [
            {
              toolId: "acid",
              when: { reactive: "yes" },
              effect: {
                observationId: "gas",
                observation: "Bubbles stream off.",
                visual: "gas",
                gasLabel: "H₂",
              },
            },
          ],
          defaultEffect: { observationId: "none", observation: "Nothing happens.", visual: "none" },
        },
      },
      categories: [
        { id: "unreactive", label: "Unreactive" },
        { id: "reactive", label: "Reactive" },
      ],
      levels: [
        {
          id: "only",
          title: "Call it",
          intro: "Predict each reaction before it runs.",
          outro: "Reaction, not identity.",
          sampleIds: ["metal", "inert"],
          toolIds: ["acid"],
          goal: {
            kind: "predict-outcome",
            prompts: [
              { sampleId: "metal", toolId: "acid" },
              { sampleId: "inert", toolId: "acid" },
            ],
          },
          scaffolding: "open",
          predictionRequired: false,
          hints: [
            {
              id: "h1",
              text: "The reactive sample gives off visible gas; the inert one stays quiet.",
            },
          ],
        },
      ],
    };
    render(<ExperimentLabViewport game={predictOutcomeGame} />);

    await user.click(screen.getByRole("button", { name: "Enter the lab" }));
    // Opens straight into the first prediction (no free tool picker).
    expect(screen.queryByRole("region", { name: "Tools" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Predict first" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.getByRole("heading", { name: "Hints" })).toBeInTheDocument();
    expect(screen.getByText(/reactive sample gives off visible gas/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Got it" }));

    // Correct on the metal (gas).
    await user.click(screen.getByRole("button", { name: "Gas bubbles off" }));
    expect(screen.getByText(/You called it/)).toBeInTheDocument();
    await waitFor(
      () => expect(screen.getByRole("heading", { name: "Predict first" })).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // Wrong on the inert chip (predict gas, it does nothing) → finishes with 1/2.
    await user.click(screen.getByRole("button", { name: "Gas bubbles off" }));
    expect(
      await screen.findByText(/You called/, undefined, { timeout: 3000 }),
    ).toHaveTextContent("You called 1 of 2 right.");
  });

  it("exposes tool + control accessible names from text, not emoji", async () => {
    const user = userEvent.setup();
    render(<ExperimentLabViewport game={smokeGame} />);
    await user.click(screen.getByRole("button", { name: "Enter the lab" }));

    // Tool buttons are findable by their visible text label — the icon beside it
    // is decorative (aria-hidden) so it does not contribute to the name.
    const tools = screen.getByRole("region", { name: "Tools" });
    const sideLight = within(tools).getByRole("button", { name: /Side light/ });
    const filter = within(tools).getByRole("button", { name: /Filter/ });
    // Accessible name is exactly the text label (no emoji glyph leaks in).
    expect(sideLight).toHaveAccessibleName("Side light");
    expect(filter).toHaveAccessibleName("Filter");
    // The chrome is inline SVG, not emoji text: an <svg> exists, aria-hidden.
    const icon = sideLight.querySelector("svg.xl-icon");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    // No emoji code points remain anywhere in the tool tray.
    expect(tools.textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u);

    // The primary control still resolves by its text label.
    expect(
      screen.getByRole("button", { name: /Test every unknown first/ }),
    ).toBeInTheDocument();
  });

  it("renders stably (no crash, strings present) with reduced motion preferred", async () => {
    // Reduced motion is a pure CSS collapse; the component must render the same
    // markup regardless. We assert the render is stable and content is intact.
    const user = userEvent.setup();
    render(<ExperimentLabViewport game={smokeGame} />);
    await user.click(screen.getByRole("button", { name: "Enter the lab" }));

    const notebook = screen.getByRole("region", { name: "Lab notebook" });
    await user.click(within(notebook).getByRole("button", { name: /Unknown X/ }));
    const tools = screen.getByRole("region", { name: "Tools" });
    await user.click(within(tools).getByRole("button", { name: /Side light/ }));

    // The evidence still lands as readable text (colour is never the only signal).
    expect(within(notebook).getByText("beam")).toBeInTheDocument();
    expect(screen.getByText("Smoke Lab")).toBeInTheDocument();
  });

  it("asks a binary tool for its second operand, then records the combination", async () => {
    const user = userEvent.setup();
    // A displacement bench: one binary "dip" tool drawing from a reagent shelf.
    // Dipping the reactive strip in copper sulfate coats it; plain water does
    // nothing — so the operand the learner picks decides the outcome.
    const dipGame: ExperimentGame = {
      id: "dip",
      title: "Dip Bench",
      definition: {
        samples: [
          { id: "iron", label: "Iron strip", properties: { reactivity: "high" }, categoryId: "reactive" },
          { id: "silver", label: "Silver strip", properties: { reactivity: "low" }, categoryId: "inert" },
        ],
        reagents: [
          { id: "copper-sulfate", label: "Copper sulfate", properties: { salt: "copper" } },
          { id: "water", label: "Plain water", properties: { salt: "none" } },
        ],
        tools: [{ id: "dip", label: "Dip in solution", operand: { kind: "reagent" } }],
        ruleSet: {
          rules: [
            {
              toolId: "dip",
              when: { reactivity: "high" },
              whenOperand: { salt: "copper" },
              effect: {
                observationId: "coat",
                observation: "A reddish layer creeps over the strip.",
                visual: "color-change",
                readout: { kind: "color", value: "reddish" },
              },
            },
          ],
          defaultEffect: { observationId: "no-change", observation: "The strip stays bright.", visual: "none" },
        },
      },
      categories: [
        { id: "reactive", label: "Reactive" },
        { id: "inert", label: "Unreactive" },
      ],
      levels: [
        {
          id: "only",
          title: "Dip the strips",
          intro: "Dip a strip into a solution and watch.",
          outro: "The eager strip coats.",
          sampleIds: ["iron", "silver"],
          toolIds: ["dip"],
          goal: { classifyIds: ["iron", "silver"], categoryIds: ["reactive", "inert"] },
          scaffolding: "open",
          predictionRequired: false,
          hints: [],
        },
      ],
    };
    render(<ExperimentLabViewport game={dipGame} />);

    await user.click(screen.getByRole("button", { name: "Enter the lab" }));
    const notebook = screen.getByRole("region", { name: "Lab notebook" });
    await user.click(within(notebook).getByRole("button", { name: /Iron strip/ }));
    const tools = screen.getByRole("region", { name: "Tools" });
    await user.click(within(tools).getByRole("button", { name: /Dip in solution/ }));

    // The tool does not fire yet — it asks which reagent to combine with, listing
    // the shelf (both reagents), not the tool defaults.
    expect(screen.getByRole("heading", { name: "Combine with…" })).toBeInTheDocument();
    expect(within(notebook).queryByText("colour")).toBeNull();
    // Picking copper sulfate applies the combination and records the reading.
    await user.click(screen.getByRole("button", { name: "Copper sulfate" }));
    expect(within(notebook).getByText("reddish")).toBeInTheDocument();
  });

  it("lets the operand picker be dismissed without acting", async () => {
    const user = userEvent.setup();
    const dipGame: ExperimentGame = {
      id: "dip2",
      title: "Dip Bench",
      definition: {
        samples: [
          { id: "iron", label: "Iron strip", properties: { reactivity: "high" }, categoryId: "reactive" },
          { id: "silver", label: "Silver strip", properties: { reactivity: "low" }, categoryId: "inert" },
        ],
        reagents: [{ id: "copper-sulfate", label: "Copper sulfate", properties: { salt: "copper" } }],
        tools: [{ id: "dip", label: "Dip in solution", operand: { kind: "reagent" } }],
        ruleSet: {
          rules: [],
          defaultEffect: { observationId: "no-change", observation: "The strip stays bright.", visual: "none" },
        },
      },
      categories: [
        { id: "reactive", label: "Reactive" },
        { id: "inert", label: "Unreactive" },
      ],
      levels: [
        {
          id: "only",
          title: "Dip the strips",
          intro: "Dip a strip into a solution and watch.",
          sampleIds: ["iron", "silver"],
          toolIds: ["dip"],
          goal: { classifyIds: ["iron", "silver"], categoryIds: ["reactive", "inert"] },
          scaffolding: "open",
          predictionRequired: false,
          hints: [],
        },
      ],
    };
    render(<ExperimentLabViewport game={dipGame} />);
    await user.click(screen.getByRole("button", { name: "Enter the lab" }));
    const notebook = screen.getByRole("region", { name: "Lab notebook" });
    await user.click(within(notebook).getByRole("button", { name: /Iron strip/ }));
    const tools = screen.getByRole("region", { name: "Tools" });
    await user.click(within(tools).getByRole("button", { name: /Dip in solution/ }));

    expect(screen.getByRole("heading", { name: "Combine with…" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    // The picker closes and no reading was recorded — the bench is live again.
    expect(screen.queryByRole("heading", { name: "Combine with…" })).toBeNull();
    expect(within(tools).getByRole("button", { name: /Dip in solution/ })).toBeEnabled();
  });

  it("surfaces a measure reading on the balance plate and in the notebook", async () => {
    const user = userEvent.setup();
    // A weigh bench: the balance reports a mass with a unit.
    const weighGame: ExperimentGame = {
      id: "weigh",
      title: "Weigh Bench",
      definition: {
        samples: [
          { id: "vial-l", label: "Vial L", properties: { mass: 10 }, categoryId: "light" },
          { id: "vial-h", label: "Vial H", properties: { mass: 50 }, categoryId: "heavy" },
        ],
        tools: [{ id: "weigh", label: "Weigh on the balance" }],
        ruleSet: {
          rules: [
            {
              toolId: "weigh",
              when: {},
              numericWhen: { mass: { op: "<", value: 30 } },
              effect: {
                observationId: "weigh-low",
                observation: "The balance settles low.",
                visual: "measure",
                readout: { kind: "measure", value: "10", unit: "g" },
              },
            },
            {
              toolId: "weigh",
              when: {},
              numericWhen: { mass: { op: ">=", value: 30 } },
              effect: {
                observationId: "weigh-high",
                observation: "The balance settles high.",
                visual: "measure",
                readout: { kind: "measure", value: "50", unit: "g" },
              },
            },
          ],
          defaultEffect: { observationId: "no-reading", observation: "Nothing to read.", visual: "none" },
        },
      },
      categories: [
        { id: "light", label: "Light" },
        { id: "heavy", label: "Heavy" },
      ],
      levels: [
        {
          id: "only",
          title: "Weigh them",
          intro: "Put each vial on the balance.",
          sampleIds: ["vial-l", "vial-h"],
          toolIds: ["weigh"],
          goal: { classifyIds: ["vial-l", "vial-h"], categoryIds: ["light", "heavy"] },
          scaffolding: "open",
          predictionRequired: false,
          hints: [],
        },
      ],
    };
    render(<ExperimentLabViewport game={weighGame} />);

    await user.click(screen.getByRole("button", { name: "Enter the lab" }));
    const notebook = screen.getByRole("region", { name: "Lab notebook" });
    await user.click(within(notebook).getByRole("button", { name: /Vial H/ }));
    const tools = screen.getByRole("region", { name: "Tools" });
    await user.click(within(tools).getByRole("button", { name: /Weigh on the balance/ }));

    // The balance plate shows the number + unit while the reading plays, and the
    // notebook auto-records the datum with its unit (real evidence, not a word).
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(within(notebook).getByText("50 g")).toBeInTheDocument();
  });

  it("plays a reach-target-state level and wins on reaching the target", async () => {
    const user = userEvent.setup();
    const neutraliseGame: ExperimentGame = {
      id: "reach",
      title: "Neutralise It",
      definition: {
        samples: [
          { id: "acid", label: "Acid beaker", properties: { nature: "acid" }, categoryId: "acid" },
        ],
        tools: [{ id: "add-base", label: "Add base" }],
        ruleSet: {
          rules: [
            {
              toolId: "add-base",
              when: { nature: "acid" },
              effect: {
                observationId: "neutralise",
                observation: "The colour settles to a flat middle tint.",
                visual: "color-change",
                readout: { kind: "color", value: "green" },
                setState: { nature: "neutral" },
              },
            },
          ],
          defaultEffect: { observationId: "none", observation: "Nothing happens.", visual: "none" },
        },
      },
      categories: [{ id: "acid", label: "Acid" }],
      levels: [
        {
          id: "only",
          title: "Neutralise the acid",
          intro: "Drive the beaker to neutral.",
          outro: "Neutralised.",
          sampleIds: ["acid"],
          toolIds: ["add-base"],
          goal: {
            kind: "reach-target-state",
            sampleId: "acid",
            target: { nature: "neutral" },
            targetLabel: "Make it neutral",
          },
          scaffolding: "open",
          predictionRequired: false,
          hints: [],
        },
      ],
    };
    render(<ExperimentLabViewport game={neutraliseGame} />);

    await user.click(screen.getByRole("button", { name: "Enter the lab" }));
    // The objective banner names the target during play.
    expect(screen.getByText(/Make it neutral/)).toBeInTheDocument();

    const tools = screen.getByRole("region", { name: "Tools" });
    await user.click(within(tools).getByRole("button", { name: /Add base/ }));

    // Reaching the target auto-wins into the reveal: the completed-transformation
    // beat still surfaces the target-reached line (now under a crediting headline).
    const reveal = await screen.findByLabelText("Reveal", undefined, {
      timeout: 3000,
    });
    expect(within(reveal).getByText(/Target reached/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "You made it happen." }),
    ).toBeInTheDocument();
    // The target label is still named in the reveal.
    expect(within(reveal).getByText(/Make it neutral/)).toBeInTheDocument();
  });
});
