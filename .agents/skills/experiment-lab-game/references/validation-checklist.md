# Validation Checklist

## Build-time gate

**Run the `validate` tool.** It is the gate — it runs everything below inside the
sandbox and reports per-level results. Run it after every change to game content,
and read the level report, not just pass/fail.

`publish` runs the same gate and refuses to publish if it fails, so there is
nothing to be gained by skipping it.

For `validate` to find your game, its `package.json` must say where the data is:

```json
"lessonplay": { "entry": "src/content/game.ts", "export": "myGame" }
```

Under the hood it calls these, from `@learn-loop/core`:

```text
validateExperimentMission(game)   // the single gate: 1 -> 2 -> 3 below
  validateExperimentGame(game)     // 1. structural / referential
  analyzeExperimentGame(game)      // 2. per-level quality (folds solveExperiment)
  replayExperimentGame(game)       // 3. plays every level through the reducer
solveExperiment(definition, level) // one level's verdict, for diagnosis
```

Each stage runs only when the previous one is clean, and its errors are returned
alone — so you always get causes before symptoms. Treat a quality defect exactly
like a structural error: do not ship it.

## Structural checks (validateExperimentGame)

- ids are unique across samples, tools, categories, levels.
- every `rule.toolId` references a known tool.
- every `sample.categoryId` references a declared category.
- an `observationId` maps to exactly one observation text.
- no rule or default-effect observation text names a declared category label
  (discovery before naming).
- every level's `sampleIds` / `toolIds` resolve; and the `goal` is coherent for
  its kind: `classify` — `classifyIds` present on the bench and `categoryIds`
  declared; `predict-outcome` — each prompt's `sampleId` on the bench and
  `toolId` offered; `reach-target-state` — `sampleId` on the bench, non-empty
  `target`, non-blank `targetLabel`.

## Quality checks (solveExperiment, per level)

A level is acceptable only when `errors` is empty. The verdict carries `goalKind`
and the checks vary by kind:

**classify:**
- `winnable` — every different-category sample pair can be told apart with the
  level's tools. `indistinguishablePairs` lists any that cannot.
- `bruteForceable` — answerable without evidence (fewer than two samples or two
  categories). Suppressed for `guided` tutorials.
- `railed` — no meaningful choice: fewer than two tools, or a single tool already
  separates every category. Suppressed for `guided` tutorials.
- `toolsNeeded` — smallest toolset that separates all categories; `> 1` confirms
  a genuine combine-causes level, `Infinity` means unwinnable.

**predict-outcome:**
- `winnable` — every prompt names a real sample/tool on the bench, and the
  prompts are not answerable by one repeated guess (at least two prompts have
  different `visual` answers). A single-answer set is flagged (`bruteForceable`,
  the "guessable" defect); suppressed for `guided` tutorials.

**reach-target-state:**
- `winnable` — the `target` is reachable from the sample's initial state with the
  offered tools (bounded search) and is **not** already satisfied at the start.
  `toolsNeeded` reports the fewest actions to reach it, `Infinity` if unreachable.

If a level is flagged, fix the *design* (add the ambiguity, vary the prompts, add
a `setState` tool that reaches the target), not the analyzer.

## Completability check (replayExperimentGame)

The analysis above reasons about the *rules*. A learner drives the *session
reducer*, which adds phases, the evidence gate on classifying, prompt walks and
per-level win conditions on top. So the last stage takes each level's winning
path and plays it through `reduceExperimentSession`, requiring every level to
reach `revealed` and the game to end in `complete`.

An error here names the level, the exact event the runtime refused, and the phase
it was in — e.g. *"the runtime refused open-classify (step 7 of 9) while in phase
exploring"*. That means the path is real but the runtime disagrees, so read the
level's goal and scaffolding rather than editing the path.

## Static checks

```bash
npm run typecheck --workspace @learn-loop/core
npm test --workspace @learn-loop/core
```

When the game ships as its own package, also typecheck/test/build that package
and assert, in its tests, that `validateExperimentMission(game).ok` is true.

## Render surface

`ExperimentLabViewport` is the shipped render surface. Visual QA must confirm:

- the 9:16 viewport has no clipped controls, unreadable labels, or body overflow;
- the beaker states are legible for `beam`, `settle`, `residue`, `fizz`,
  `color-change`, `gas`, and `precipitate`;
- the `gasLabel` chip is readable when `visual === "gas"` and observation prose
  stays sensory rather than naming the gas;
- tool buttons, the tappable notebook rows (which select the active sample), any
  prediction choices, and notebook cells remain usable on mobile-size viewports;
- the Hint panel opens and dismisses cleanly — it is a modal, so it must never
  permanently cover the bench or leave the player with no way back;
- classify and reveal overlays work end-to-end and keep concept labels hidden
  until the learner submits a correct classification;
- for `predict-outcome` levels, the prompt walk advances through every prompt and
  the reveal shows the score; for `reach-target-state`, the objective banner names
  the target during play and reaching it wins into the reveal.
