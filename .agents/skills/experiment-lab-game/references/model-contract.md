# Model Contract

Author the game as `ExperimentGame` data from `@learn-loop/core`. All types are
exported from the package root.

## Required shape

```text
ExperimentGame
  id, title, conceptName?
  definition: ExperimentDefinition
    samples: ExperimentSample[]
    tools:   ExperimentTool[]
    ruleSet: ExperimentRuleSet
    reagents?: ExperimentReagent[]   (only for binary tools — see below)
  categories: ExperimentCategory[]
  levels:     ExperimentLevel[]
```

## Samples

`ExperimentSample = { id, label, properties, categoryId, revealLabel? }`

- `properties` is the **hidden ground truth** the simulation reasons over
  (e.g. `{ particleSize: "coarse" }`). Never shown to the player. A value is a
  **string** (`"coarse"`) or a **number** (`ph: 2`, `dissolved: 0`,
  `saturationPoint: 30`); numbers unlock threshold/range rules and
  accumulation — see "Numeric properties" below.
- `label` is the public, learner-facing name (`"Unknown B"`). Never the answer.
- `categoryId` is the classification answer; it must match an `ExperimentCategory.id`.
  It is **required on every sample**, even one used only in a `predict-outcome` or
  `reach-target-state` level where nothing is classified — the structural validator
  always checks it resolves. Give such a sample a plain declared category (e.g. a
  copper-sulphate crystal → a `hydrated-salt` category); it is never graded there,
  and the uniform "every sample has a category" rule is one less thing to get wrong.
- `revealLabel` is the optional real-world identity for the reveal
  (`"chalk water"`).
- Drive every outcome from `properties`. Two samples that should behave
  identically must share the same property values — the engine is consistent by
  construction, so do not try to make "the same thing" behave two ways.
- Include a **control / reference** sample where it aids reasoning. A control is
  present on the bench but is left out of `goal.classifyIds` (it is not graded).

## Tools

`ExperimentTool = { id, label, description?, operand? }`

- A tool is an operator over sample state, not a fixed answer key.
- `operand?` makes the tool **binary** — it acts on the chosen sample *plus* a
  second thing: `{ kind: "sample" }` (another bench sample) or
  `{ kind: "reagent" }` (a shelf reagent from `definition.reagents`). See
  "Binary tools and reagents" below. Omit it for the ordinary unary tool.
- Every tool offered in a level must have at least one rule that fires for it,
  or the validator flags it as inert.

## Rules

`ExperimentRuleSet = { rules: ExperimentRule[], defaultEffect: ExperimentEffect }`
`ExperimentRule = { toolId, when, numericWhen?, whenOperand?, numericWhenOperand?, effect }`

- Rules are **first-match-wins**: order specific `when` constraints before
  general ones.
- `when` is **required on every rule**: a set of string-equality property
  constraints that must **all** match the sample's current state for the rule
  to fire. A rule that fires on any state (e.g. one gated only by
  `numericWhen`) still needs `when: {}` — a rule with no `when` fails
  validation.
- `numericWhen?` adds numeric constraints on the same sample, evaluated in
  addition to `when` — every entry must hold. Each value is either a
  **threshold** `{ op: ">=" | "<=" | ">" | "<" | "==", value: 7 }` (or
  `{ op, property: "saturationPoint" }` to compare against another property of
  the *same* sample) or a **range** `{ min?, max? }` (inclusive). Comparing a
  property the sample lacks, or a non-number, simply fails to match.
- `whenOperand?` / `numericWhenOperand?` are the same two constraint sets applied
  to the **second operand** of a binary tool (see below). Ignored on unary tools.
- `defaultEffect` fires for any tool/state combination no rule covers, keeping
  the world consistent (typically a neutral "nothing observable happens").
- Use `effect.setState` to make a cause persist so later causes can depend on it
  (e.g. a suspension becomes `settled` after standing). State threads through a
  sequence via `runExperimentSequence`.

## Effects and visuals

`ExperimentEffect = { observationId, observation, visual, gasLabel?, readout?, setState?, addState?, setOperandState?, addOperandState? }`

- `observationId` is a stable handle; the same id must always carry the same
  `observation` text (the validator enforces this).
- `observation` describes **only what is seen**, never the inference. See
  `authoring-contract.md`.
- `visual` must be one of `EXPERIMENT_VISUALS`:
  `"beam" | "settle" | "residue" | "fizz" | "color-change" | "gas" |
  "precipitate" | "conductivity" | "temperature" | "ph-scale" | "odour" |
  "measure" | "none"`. All are animated by the `Beaker`; `measure` shows a
  balance / graduated scale surfacing a number, and pairs with a `measure`
  readout.
- `gasLabel?` is a short gas token shown as a chip on the escaping bubbles, e.g.
  `"H₂"` / `"CO₂"` / `"O₂"`. Set it only when `visual === "gas"` (the validator
  rejects it on any other visual); when the chip names the gas, keep
  `observation` sensory and neutral instead of repeating the gas identity.
- `readout?` is a structured reading `{ kind, value, unit? }` — the *specific*
  clue a learner records. `kind` is one of `EXPERIMENT_READOUT_KINDS`
  (`"color" | "ph-scale" | "conductivity" | "temperature" | "odour" | "measure"`)
  and `value` is the datum as a string (`"red"`, `"2"`, `"on"`, `"hot"`,
  `"pungent"`, `"80"`). `unit?` (`"g"`, `"mL"`) is shown after a `measure`
  value and is cosmetic. Use a readout whenever the evidence is the reading
  itself rather than merely that something changed.
- **Distinguishability is measured on the visible evidence token** — `visual`
  plus any `readout` `value` and `gasLabel` — not on `observationId` or text. So
  two samples can share a `visual` (both `color-change`) and still be
  distinguishable if their readout differs (red vs blue), and two samples that
  should be hard to tell apart must match on `visual` **and** readout/gas for the
  ambiguous tool. This is how a "designed ambiguity" is made mechanically real
  (see `gameplay-contract.md`).

### Typical tool → visual pairings

Tool ids are free-form data; the viewport only uses them for an icon (with a
generic fallback). These are the conventional pairings the icon set and the
animated visuals are built around:

| Tool id | Icon | Usual visual(s) |
| :-- | :-- | :-- |
| `light` | 🔦 | `beam` (Tyndall) |
| `settle` | ⏳ | `settle` |
| `filter` | 🧪 | `residue` |
| `acid` | 💧 | `fizz` / `gas` (H₂, CO₂) |
| `heat` / `flame` | 🔥 | `fizz` / `gas` / `color-change` |
| `base` | 🧴 | `color-change` / `precipitate` |
| `litmus` | 🟪 | `color-change` + readout `color` |
| `ph-paper` | 🟪 | `ph-scale` + readout `ph-scale` (`"0"`–`"14"`) |
| `conductivity` | 💡 | `conductivity` + readout `conductivity` (`"on"`/`"off"`) |
| `zinc` / `metal` | 🔩 | `gas` (H₂ from acids) |
| `thermometer` | 🌡️ | `temperature` + readout `temperature` (`"hot"`/`"warm"`/`"cold"`) |
| `limewater` | 🥛 | `precipitate` (milky) |
| `water` | 💧 | (dissolving — usually `none` for now) |
| `magnet` | 🧲 | `none` (magnetic = a non-visual property) |
| `evaporate` | ♨️ | `residue` |
| `stir` | 🥄 | (mixing — usually `none`) |

Any tool id outside this list still works; it just renders the generic 🔬 icon.

### State changes

- `setState?` **replaces** the named properties on the sample after the effect
  (absolute set), so later causes can depend on earlier ones: a suspension
  becomes `{ settled: "yes" }` after standing; `add-base` flips
  `nature: "acid"` → `"neutral"`.
- `addState?` **adds** a numeric delta to each named property, applied after
  `setState` (a missing base counts as 0): `{ dissolved: 10 }` per spoon of
  solute, `{ ph: 1 }` per drop of base. This is how an amount grows across
  probes until a `numericWhen` threshold rule takes over.
- `setOperandState?` / `addOperandState?` do the same to the second operand of a
  binary tool.

## Numeric properties

Give a property a number when the *amount* is the lesson — saturation, pH,
mass, volume. The pattern is: a numeric starting value in `properties`, a tool
whose effect carries `addState`, and a `numericWhen` rule ordered **before** the
general one so it wins once the threshold is crossed:

```ts
samples: [{ id: "a", label: "Beaker A", properties: { dissolved: 0, saturationPoint: 30 }, categoryId: "..." }],
tools: [{ id: "add-salt", label: "Add a spoon of salt" }],
ruleSet: {
  rules: [
    // Past the sample's own hidden capacity: the spoon no longer dissolves.
    { toolId: "add-salt", when: {}, numericWhen: { dissolved: { op: ">=", property: "saturationPoint" } },
      effect: { observationId: "salt-settles", observation: "Grains sink and stay on the bottom.", visual: "settle" } },
    // Otherwise it dissolves, and the amount climbs.
    { toolId: "add-salt", when: {},
      effect: { observationId: "salt-dissolves", observation: "The grains vanish as you stir.", visual: "none", addState: { dissolved: 10 } } },
  ],
  defaultEffect: { observationId: "nothing", observation: "Nothing you can see changes.", visual: "none" },
},
```

Ranges express bands: `numericWhen: { ph: { min: 6, max: 8 } }` for "near
neutral". A `reach-target-state` goal can require a number too via
`numericTarget` (see `gameplay-contract.md`).

## Binary tools and reagents

A **binary** tool combines the chosen sample with a second operand, so one tool
yields different outcomes depending on *what it meets* — iron in copper
sulfate vs iron in water, acid on a metal vs acid on a carbonate.

- Declare it with `operand: { kind: "sample" }` (the learner picks another bench
  sample) or `operand: { kind: "reagent" }` (the learner picks from the shelf).
- `ExperimentReagent = { id, label, properties }` lives in
  `definition.reagents`. It carries hidden `properties` like a sample but is
  never classified, so it has no `categoryId`.
- Rules for a binary tool constrain the operand with `whenOperand` /
  `numericWhenOperand`; `when` / `numericWhen` still describe the primary sample.
- A `predict-outcome` prompt for a binary tool names the partner with
  `operandId` (a sample id or reagent id).

```ts
tools: [{ id: "dip-metal", label: "Dip a metal strip", operand: { kind: "reagent" } }],
reagents: [
  { id: "copper-sulfate", label: "Copper sulfate solution", properties: { ion: "copper" } },
  { id: "water", label: "Water", properties: { ion: "none" } },
],
rules: [
  { toolId: "dip-metal", when: { metal: "iron" }, whenOperand: { ion: "copper" },
    effect: { observationId: "brown-coat", observation: "A reddish-brown layer forms on the strip.", visual: "color-change", readout: { kind: "color", value: "reddish-brown" } } },
],
```

Use a binary tool only when the pairing *is* the concept (displacement,
neutralisation); a unary tool with rules over hidden properties covers most
identification activities.

## Categories

`ExperimentCategory = { id, label, definition? }`

- `label` is the concept name revealed last (`"Colloid"`). Keep it out of all
  observation text.
- `definition` is the one-line payoff shown in the reveal.
- Every `sample.categoryId` must reference a declared category id.

## Levels and goals

`ExperimentLevel = { id, title, intro, outro?, sampleIds, toolIds, goal,
scaffolding, predictionRequired, hints }`

- `sampleIds` / `toolIds` are the subset of the bench present in this level.
  Levels share one `ExperimentDefinition` and differ only in what they expose and
  what `goal` they set.
- `scaffolding` is `"guided" | "hinted" | "open"` (see `gameplay-contract.md`).
- `goal` is a discriminated union over `kind` — pick the shape that matches the
  activity (full design guidance in `gameplay-contract.md`):
  - `{ kind?: "classify", classifyIds, categoryIds }` — sort samples into
    categories (default; `kind` may be omitted).
  - `{ kind: "predict-outcome", prompts: [{ sampleId, toolId }] }` — predict each
    tool's visible `visual` before it runs; graded on correctness.
  - `{ kind: "reach-target-state", sampleId, target, numericTarget?, targetLabel }`
    — drive one sample's state to satisfy `target` (and any `numericTarget`
    thresholds/ranges); needs a `setState` / `addState` tool that reaches it.
- Narrow a goal with the exported guards `isClassifyGoal` /
  `isPredictOutcomeGoal` / `isReachTargetStateGoal`, or read `experimentGoalKind`.

## Worked reference

The tested gold-standard fixture is the "Invisible Particle Detective" bench:
one hidden property `particleSize` (`tiny` / `fine` / `coarse`) plus three tools
(`light`, `settle`, `filter`) yields solution / suspension / colloid. See
`references/invisible-particle-detective.ts` for a complete, analyzer-passing
`ExperimentGame` that stays inside this skill's readable reference tree.
