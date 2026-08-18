import type {
  ExperimentDefinition,
  ExperimentGame,
  ExperimentRuleSet,
} from "../../src/model/experimentLab";

/**
 * Fixtures for the two ExperimentLab primitives added in issue #96:
 * **binary/combination operations** and **numeric/quantitative state**. They are
 * small but read like real mini-games, so the deep-module tests exercise
 * observable behaviour (effects, next state, verdicts) rather than internals.
 */

/* -------------------------------------------------------------------------- */
/* Binary: "combine causes" displacement — winnable only by combining          */
/* -------------------------------------------------------------------------- */

/**
 * Three metals dipped into two salt solutions (a reactivity-series bench). No
 * single dip separates all three categories — the metal that reacts with both
 * salts and the one that reacts with only the first look identical in salt A —
 * so the level is only winnable by *combining* the two dips. This is the binary
 * analogue of the designed-ambiguity classify.
 */
export const displacementBench: ExperimentDefinition = {
  samples: [
    {
      id: "metal-x",
      label: "Metal X",
      properties: { reactsWithA: "yes", reactsWithB: "yes" },
      categoryId: "reactive-both",
    },
    {
      id: "metal-y",
      label: "Metal Y",
      properties: { reactsWithA: "yes", reactsWithB: "no" },
      categoryId: "reactive-a-only",
    },
    {
      id: "metal-z",
      label: "Metal Z",
      properties: { reactsWithA: "no", reactsWithB: "no" },
      categoryId: "inert",
    },
  ],
  reagents: [
    { id: "salt-a", label: "Salt A solution", properties: { salt: "A" } },
    { id: "salt-b", label: "Salt B solution", properties: { salt: "B" } },
  ],
  tools: [
    {
      id: "dip",
      label: "Dip in a salt solution",
      description: "Lower the metal into a beaker of salt solution and watch.",
      operand: { kind: "reagent" },
    },
  ],
  ruleSet: {
    rules: [
      {
        toolId: "dip",
        when: { reactsWithA: "yes" },
        whenOperand: { salt: "A" },
        effect: {
          observationId: "dip-a-deposit",
          observation: "A reddish coating creeps over the metal.",
          visual: "color-change",
          readout: { kind: "color", value: "reddish" },
        },
      },
      {
        toolId: "dip",
        when: { reactsWithB: "yes" },
        whenOperand: { salt: "B" },
        effect: {
          observationId: "dip-b-deposit",
          observation: "A reddish coating creeps over the metal.",
          visual: "color-change",
          readout: { kind: "color", value: "reddish" },
        },
      },
    ],
    defaultEffect: {
      observationId: "dip-none",
      observation: "The metal stays bright; the solution is unchanged.",
      visual: "none",
    },
  },
};

export const displacementGame: ExperimentGame = {
  id: "displacement-fixture",
  title: "Which metals push copper out?",
  conceptName: "Reactivity series (displacement)",
  definition: displacementBench,
  categories: [
    { id: "reactive-both", label: "Reactive metal" },
    { id: "reactive-a-only", label: "Middling metal" },
    { id: "inert", label: "Unreactive metal" },
  ],
  levels: [
    {
      id: "combine-dips",
      title: "Two solutions, three metals",
      intro:
        "Dip each metal into both salt solutions. One dip is not enough — combine what the two dips tell you.",
      sampleIds: ["metal-x", "metal-y", "metal-z"],
      toolIds: ["dip"],
      goal: {
        classifyIds: ["metal-x", "metal-y", "metal-z"],
        categoryIds: ["reactive-both", "reactive-a-only", "inert"],
      },
      scaffolding: "open",
      predictionRequired: false,
      hints: [],
    },
  ],
};

/**
 * A tiny displacement bench (iron / silver + copper-sulfate or water) used to
 * assert that the *same* tool yields a different effect depending on its operand.
 */
export const ironCopperBench: ExperimentDefinition = {
  samples: [
    {
      id: "iron",
      label: "Iron nail",
      properties: { reactivity: "high" },
      categoryId: "reactive",
    },
    {
      id: "silver",
      label: "Silver coin",
      properties: { reactivity: "low" },
      categoryId: "inert",
    },
  ],
  reagents: [
    {
      id: "copper-sulfate",
      label: "Copper sulfate solution",
      properties: { solution: "copper-salt" },
    },
    { id: "water", label: "Plain water", properties: { solution: "water" } },
  ],
  tools: [
    {
      id: "dip",
      label: "Dip",
      operand: { kind: "reagent" },
    },
  ],
  ruleSet: {
    rules: [
      {
        toolId: "dip",
        when: { reactivity: "high" },
        whenOperand: { solution: "copper-salt" },
        effect: {
          observationId: "iron-deposit",
          observation: "A reddish-brown layer builds on the nail.",
          visual: "color-change",
          readout: { kind: "color", value: "reddish" },
          // The nail is now coated; a marker so later causes can depend on it.
          setState: { coated: "yes" },
        },
      },
    ],
    defaultEffect: {
      observationId: "no-change",
      observation: "Nothing observable happens.",
      visual: "none",
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Numeric: accumulation to a saturation point                                 */
/* -------------------------------------------------------------------------- */

/**
 * A saturation bench: each spoon of solute adds to `dissolved` while it stays
 * below the sample's hidden `saturationPoint`; once it reaches the point, no more
 * dissolves and undissolved powder settles. The threshold compares one property
 * to another (`dissolved` vs `saturationPoint`), so the point is per-sample and
 * rule-derived, never hand-authored.
 */
export const saturationRuleSet: ExperimentRuleSet = {
  rules: [
    {
      toolId: "add-solute",
      when: {},
      numericWhen: { dissolved: { op: "<", property: "saturationPoint" } },
      effect: {
        observationId: "dissolves",
        observation: "The powder swirls and disappears into the water.",
        visual: "none",
        addState: { dissolved: 10 },
      },
    },
    {
      toolId: "add-solute",
      when: {},
      numericWhen: { dissolved: { op: ">=", property: "saturationPoint" } },
      effect: {
        observationId: "no-more-dissolves",
        observation: "The powder drifts down and gathers at the bottom.",
        visual: "settle",
      },
    },
  ],
  defaultEffect: {
    observationId: "nothing",
    observation: "Nothing happens.",
    visual: "none",
  },
};

/* -------------------------------------------------------------------------- */
/* Numeric: a measured number is the only discriminator between two categories */
/* -------------------------------------------------------------------------- */

/**
 * Three vials that share a colour in pairs and a mass bucket in pairs, so
 * neither the colour tool nor the balance separates all three alone: the *light*
 * and *medium* vials look identical to the eye and differ **only in the measured
 * mass**, while the *medium* and *heavy* vials weigh the same and differ only in
 * colour. Winnable only by combining a categorical clue with a numeric reading.
 */
export const numericMeasureBench: ExperimentDefinition = {
  samples: [
    {
      id: "vial-l",
      label: "Vial L",
      properties: { tint: "pale", mass: 10 },
      categoryId: "light",
    },
    {
      id: "vial-m",
      label: "Vial M",
      properties: { tint: "pale", mass: 50 },
      categoryId: "medium",
    },
    {
      id: "vial-h",
      label: "Vial H",
      properties: { tint: "dark", mass: 50 },
      categoryId: "heavy",
    },
  ],
  tools: [
    { id: "look", label: "Look at the tint" },
    { id: "weigh", label: "Weigh on the balance" },
  ],
  ruleSet: {
    rules: [
      {
        toolId: "look",
        when: { tint: "pale" },
        effect: {
          observationId: "look-pale",
          observation: "The liquid is a pale straw colour.",
          visual: "color-change",
          readout: { kind: "color", value: "pale" },
        },
      },
      {
        toolId: "look",
        when: { tint: "dark" },
        effect: {
          observationId: "look-dark",
          observation: "The liquid is a deep amber.",
          visual: "color-change",
          readout: { kind: "color", value: "dark" },
        },
      },
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
        numericWhen: { mass: { min: 30, max: 70 } },
        effect: {
          observationId: "weigh-mid",
          observation: "The balance settles in the middle.",
          visual: "measure",
          readout: { kind: "measure", value: "50", unit: "g" },
        },
      },
    ],
    defaultEffect: {
      observationId: "no-reading",
      observation: "The instrument shows nothing.",
      visual: "none",
    },
  },
};

export const numericMeasureGame: ExperimentGame = {
  id: "numeric-measure-fixture",
  title: "Weigh and look",
  definition: numericMeasureBench,
  categories: [
    { id: "light", label: "Light sample" },
    { id: "medium", label: "Middle sample" },
    { id: "heavy", label: "Heavy sample" },
  ],
  levels: [
    {
      id: "measure-and-look",
      title: "The balance and the eye",
      intro: "Two of these look the same; two weigh the same. Combine both clues.",
      sampleIds: ["vial-l", "vial-m", "vial-h"],
      toolIds: ["look", "weigh"],
      goal: {
        classifyIds: ["vial-l", "vial-m", "vial-h"],
        categoryIds: ["light", "medium", "heavy"],
      },
      scaffolding: "open",
      predictionRequired: false,
      hints: [],
    },
  ],
};
