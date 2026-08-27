# Validation Checklist

## Build-time gate

**Run the `validate` tool.** It is the gate. Run it after every change to the
mission content, before anything else.

`publish` runs the same gate and refuses to publish if it fails.

For `validate` to find your game, its `package.json` must say where the data is:

```json
"lessonplay": { "entry": "src/content/missions.ts", "export": "myGame" }
```

Under the hood it calls `validateSandboxLabMission`, which runs three stages in
order, each only when the previous one is clean:

```text
1. validateSandboxLabPresentation  // structural / referential, investigation contract
2. solveSandboxLabMission          // a winning path exists: stages clear, a correct
                                   //   conclusion unlocks
3. replaySandboxLabMission         // that path is walked through the real session
                                   //   reducer and a correct conclusion is submitted
```

Stage 3 is what makes "completable" a fact. Note what it protects against: the
runtime advances a stage the moment its `requiredEvidence` is complete, and a
later stage may not show an earlier stage's materials again. So a stage that can
produce evidence it does not itself require, where a conclusion needs that
evidence, is only winnable if the player collects it *before* clearing the stage.
If replay reports a stall, check for exactly this before touching anything else.

## Static checks

```bash
npm run typecheck --workspace @learn-loop/core
npm test --workspace @learn-loop/core
npm run typecheck --workspace <game-package-name>
npm test --workspace <game-package-name>
npm run build --workspace <game-package-name>
```

The game tests should also cover what the gate cannot:
- mission lists stay in lockstep
- at least one full scenario sequence reaches the expected workspace state
- hidden identities are absent before a correct conclusion
- every investigation stage offers a meaningful material/tool choice

## Visual QA Checklist

The app agent does not always have browser automation. Do not try to call
browser tools unless the runtime explicitly provides them. When browser access is
not available, report that visual/mobile QA was not run and use this checklist
as manual follow-up guidance:

- no horizontal overflow
- no vertical overflow
- header, mission, experiment, tool tray, feedback, and notebook are visible
- mission menu opens
- mission menu can switch missions
- one mission can perform its first expected action
- feedback appears after action
- `Next step` appears after action resolves
- notebook explanation is readable
- station visuals match the intended experiment

If screenshots show clipped text, cramped tools, unclear station visuals, or
overlap, fix the template package when the issue is reusable. Fix game-local CSS
only when the problem is genuinely game-specific outer chrome.
