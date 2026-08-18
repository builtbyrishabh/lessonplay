import type { SandboxLabGame, SandboxLabMission } from "@learn-loop/core";

const COLORLESS = "#dfe9f5";
const PINK = "#e8508f";

/**
 * One deliberately small, disposable mission proving the current template
 * seam. Replace this data when starting a real chemistry game; do not fork the
 * viewport or add game-specific layout code.
 */
export const indicatorMission: SandboxLabMission = {
  scenario: {
    id: "indicator-template",
    title: "Test Unknown A",
    concept: "Use observable evidence to classify an unknown solution",
    grade: 9,
    entities: [
      {
        id: "unknown-solution",
        label: "Unknown solution",
        color: COLORLESS,
        kind: "acid",
      },
      { id: "indicator", label: "Indicator", color: COLORLESS, kind: "indicator" },
      {
        id: "sodium-hydroxide",
        label: "Sodium hydroxide",
        color: "#d8f0d8",
        kind: "base",
      },
      {
        id: "distilled-water",
        label: "Distilled water",
        color: "#cfe6f5",
        kind: "neutral",
      },
      { id: "salt", label: "Salt", color: COLORLESS, kind: "salt" },
      { id: "water", label: "Water", color: COLORLESS, kind: "neutral" },
    ],
    shelf: ["sodium-hydroxide", "distilled-water"],
    stations: {
      unknown: {
        contents: ["unknown-solution", "indicator"],
        color: COLORLESS,
        heat: "room",
        phase: "solution",
      },
    },
    rules: [
      {
        id: "neutralisation",
        on: "pour",
        requires: ["unknown-solution", "indicator", "sodium-hydroxide"],
        transform: {
          kind: "react",
          consume: ["unknown-solution", "sodium-hydroxide"],
          produce: ["salt", "water"],
          newColor: PINK,
          heat: "warm",
        },
        observation: "The indicator turns pink and the vessel becomes warmer.",
        explanation:
          "The colour and temperature changes are evidence of neutralisation.",
      },
    ],
    steps: [
      {
        id: "test-the-unknown",
        predictPrompt: "Which test can produce useful evidence?",
        options: [
          {
            label: "Use a diagnostic reagent",
            correct: true,
            feedback: "A diagnostic reagent can reveal an observable property.",
          },
          {
            label: "Only add water",
            correct: false,
            feedback: "Water may dilute the sample without identifying it.",
          },
        ],
        goal: "Produce evidence that distinguishes the unknown.",
        hints: { pour: "Compare the two available liquids." },
        actionPrompt: "Choose a liquid and observe the result.",
        expect: {
          type: "pour",
          reagent: "sodium-hydroxide",
          target: "unknown",
        },
        explanation:
          "A colour change and warming provide evidence for an acid-base reaction.",
      },
    ],
  },
  presentation: {
    scenarioId: "indicator-template",
    mode: "investigation",
    badge: "Starter mission",
    question: "What does the reagent evidence tell you about Unknown A?",
    materials: [
      {
        id: "unknown-a",
        label: "Unknown A",
        stationId: "unknown",
        description: "A clear solution whose identity must be inferred.",
        hiddenIdentity: {
          revealLabel: "Dilute acid",
          forbiddenTerms: ["hydrochloric acid", "HCl"],
        },
      },
    ],
    tools: [
      {
        id: "add-base",
        label: "Sodium hydroxide",
        action: { type: "pour", reagent: "sodium-hydroxide" },
      },
      {
        id: "add-water",
        label: "Distilled water",
        action: { type: "pour", reagent: "distilled-water" },
      },
    ],
    interactions: [
      {
        id: "diagnostic-result",
        materialId: "unknown-a",
        toolId: "add-base",
        evidenceId: "pink-and-warm",
        feedbackCard: {
          action: "You added sodium hydroxide to Unknown A.",
          result: "The indicator turns pink and the vessel becomes warmer.",
          why: "Both observations are evidence of neutralisation.",
          next: "Record the evidence and classify the unknown.",
          notebook: "Unknown A turned pink and became warmer after the test.",
        },
        soundCue: "pour",
        reactionEffect: "color-change",
        effectTags: ["color-change"],
      },
      {
        id: "water-control",
        materialId: "unknown-a",
        toolId: "add-water",
        evidenceId: "water-no-clue",
        feedbackCard: {
          action: "You added distilled water to Unknown A.",
          result: "There is no distinctive visible change.",
          why: "Dilution alone does not provide enough evidence to classify it.",
          next: "Try the reagent that can create a diagnostic change.",
          notebook: "Adding water produced no useful classification evidence.",
        },
        soundCue: "wrong-tool",
        reactionEffect: "dissolve",
      },
    ],
    stages: [
      {
        id: "test",
        title: "Choose a useful test",
        goal: "Find an observable clue about Unknown A.",
        materialIds: ["unknown-a"],
        toolIds: ["add-base", "add-water"],
        requiredEvidence: ["pink-and-warm"],
        nextPrompt: "Compare what each available liquid can reveal.",
      },
    ],
    conclusions: [
      {
        id: "acid",
        label: "Unknown A was acidic.",
        correct: true,
        requiresEvidence: ["pink-and-warm"],
        feedback: "Correct. The observed changes support neutralisation.",
      },
      {
        id: "neutral",
        label: "Unknown A was neutral.",
        correct: false,
        requiresEvidence: ["pink-and-warm"],
        feedback: "That does not explain both observed changes.",
      },
    ],
    notebook: {
      goal: "Classify the unknown from observations rather than its label.",
      hints: ["Look for a test that changes more than dilution would."],
      explanation:
        "The colour and temperature evidence support the final classification.",
    },
    stationVisuals: [
      {
        stationId: "unknown",
        kind: "beaker",
        label: "Unknown A",
        effectTags: ["color-change"],
      },
    ],
    completionMessage: "Unknown A classified from evidence.",
  },
};

export const chemistryLabTemplate: SandboxLabGame = {
  title: "Indicator Detective",
  eyebrow: "ChemQuest Lab · Class 9",
  missions: [indicatorMission],
};
