# Implementation Pattern

The project you edit is a copy of the `chemistry-lab-bench` starter — a
ChemQuest / SandboxLab game that already builds, tests and validates. An
ExperimentLab game keeps that build and swaps out the four files that make it
a SandboxLab game. Do not assemble a project from scratch, and do not read the
engine's source to learn the layout: this page **is** the layout.

## Starting layout

```text
package.json              lessonplay.entry / export        → CHANGE (step 2)
index.html                page shell                        → keep (retitle if you like)
vite.config.ts            singlefile build + vitest config  → keep
tsconfig.json                                               → keep
src/main.tsx              mounts <App/>, imports the skin   → CHANGE the import (step 4)
src/ui/App.tsx            renders SandboxLabViewport        → REPLACE (step 3)
src/content/missions.ts   SandboxLab data                   → DELETE; game.ts replaces it (step 1)
src/style.css             document reset only               → keep
tests/setup.ts            vitest + jest-dom                 → keep
tests/missions.test.ts    tests missions.ts                 → REPLACE (step 5; `publish` runs the tests)
```

Everything not listed as CHANGE / REPLACE / DELETE stays exactly as it is.
Dependencies are already installed (`node_modules` links to the engine's);
never run `npm install`.

## Step 1 — `src/content/game.ts` (new): the whole game as data

```ts
import type { ExperimentGame } from "@learn-loop/core";

export const game: ExperimentGame = {
  id: "acids-bases-detective",
  title: "The Colourless Bottles",
  conceptName: "Acids and bases",
  definition: {
    samples: [/* hidden properties + categoryId */],
    tools: [/* operators */],
    ruleSet: { rules: [/* first-match-wins */], defaultEffect: { /* neutral */ } },
    // reagents: [/* only for binary tools */],
  },
  categories: [/* revealed last */],
  levels: [/* guided -> hinted -> open */],
};
```

One named export holding one `ExperimentGame`; author it per
`model-contract.md`, `gameplay-contract.md` and `authoring-contract.md`. Then
`rm src/content/missions.ts` — nothing may import it afterwards.

## Step 2 — `package.json`: point the gate at the data

Change only the `lessonplay` field; the scripts and dependencies are the
engine's and must stay:

```json
"lessonplay": { "entry": "src/content/game.ts", "export": "game" }
```

`validate` and `publish` read this to find the game. A wrong path or export
name is reported as "game not found" (exit 2), never as a pass.

## Step 3 — `src/ui/App.tsx`: the shipped render surface

```tsx
import { ExperimentLabViewport } from "@learn-loop/core/ui";
import { game } from "../content/game";

export function App() {
  return (
    <ExperimentLabViewport
      game={game}
      completionMessage="You worked out what was in every bottle from evidence alone."
    />
  );
}
```

Props: `game` (required), `title?` (defaults to `game.title`),
`completionMessage?`, `theme?` (named tokens only — see SKILL.md → Rendering).
No `useState`, no mission picker, no wrapper element: the viewport is the page.

## Step 4 — `src/main.tsx`: the ExperimentLab skin

Swap the stylesheet import and keep everything else:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "@learn-loop/core/ui/experiment.css"; // was styles.css (the SandboxLab skin)
import "./style.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

## Step 5 — `tests/game.test.ts` replaces `tests/missions.test.ts`

`publish` runs `npm test`, and the starter's test imports the file deleted in
step 1, so `rm tests/missions.test.ts` and write:

```ts
import { describe, expect, it } from "vitest";
import { validateExperimentMission } from "@learn-loop/core";

import { game } from "../src/content/game";

describe(game.title, () => {
  it("passes the engine's structural, quality and replay gates", () => {
    expect(validateExperimentMission(game)).toEqual({ ok: true, errors: [] });
  });
});
```

This is the same gate `validate` runs; keeping it as a test means a later edit
that breaks the game fails the build, not just the tool.

## Order of work

1. `write` `src/content/game.ts`, then `bash`: `rm src/content/missions.ts tests/missions.test.ts`.
2. `edit` `package.json` (`lessonplay`), `write` `src/ui/App.tsx`, `edit` `src/main.tsx`, `write` `tests/game.test.ts`.
3. `validate`. Fix what its per-level report says (see `validation-checklist.md`).
4. `publish` — it runs validate, `npm test` and `npm run build` itself.

Five files touched, two deleted. If you find yourself listing directories or
reading engine sources, stop: everything the engine accepts is in this skill's
references.
