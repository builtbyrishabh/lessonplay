# ChemQuest Lab Template

This folder is the minimal, working reference for LessonPlay's current guided
chemistry-game architecture. It is a starter, not a collection of completed
games.

```text
SandboxLabGame data
  -> @learn-loop/core validator and engine
  -> SandboxLabViewport from @learn-loop/core/ui
  -> browser game
```

The included Indicator Detective mission is intentionally small. It exists only
to prove the complete seam: data validation, deterministic solvability, shared
session behavior, the fixed 9:16 viewport, and a production build.

## What to change for a new game

Replace the data in `src/content/missions.ts`:

- scenario entities, stations, rules, and expected actions;
- investigation materials, tools, interactions, and evidence;
- stages and evidence-backed conclusions;
- approved station visual kinds and theme tokens.

Keep `src/ui/App.tsx` thin. The shared `SandboxLabViewport` owns the mission
drawer, stage, tool dock, feedback, notebook, conclusion UI, and responsive
layout. Do not copy those modules into this folder or build a parallel lab UI.

Game-local `src/style.css` intentionally contains only the document reset.

## Run

From the repository root:

```bash
npm install
npm run dev --workspace @lessonplay/chemistry-lab-template
```

Open `http://localhost:5182`.

## Verify

```bash
npm run typecheck --workspace @lessonplay/chemistry-lab-template
npm test --workspace @lessonplay/chemistry-lab-template
npm run build --workspace @lessonplay/chemistry-lab-template
```

The focused test verifies that the starter mission passes the shared structural
and solvability gates and reaches its expected visible state through the shared
engine.
