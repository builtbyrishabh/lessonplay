# LessonPlay — chemistry learning-game studio

Monorepo (npm workspaces):

- `apps/web` — Next.js product. Mastra chat agent built factory-style; see `apps/web/CLAUDE.md`.
- `packages/learn-loop-core` — `@learn-loop/core` engine: ExperimentLab + ChemQuest Lab models, validators (`validateExperimentMission`, `validateSandboxLabMission`), solvers, viewports.
- `games/chemistry-lab-bench` — only checked-in game; a thin template consuming the engine. Do not expand it.
- `.agents/skills` (mirrored byte-identical to `.claude/skills`) — `discovery-game-planner`, `experiment-lab-game`, `chemquest-lab-game`.

Checks: `npm test && npm run typecheck` from root.

Slice plan: 1) chatbot (threads, streaming, memory) → 2) skills + engine tools + publish gate → 3) auth/deploy.
