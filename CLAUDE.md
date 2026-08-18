# LessonPlay — chemistry learning-game studio

T3 stack at the repo root: Next.js App Router + tRPC + Drizzle (Postgres) + Clerk + Tailwind.

- Auth: Clerk. `src/middleware.ts` protects everything except `/sign-in`, `/sign-up`.
  tRPC context exposes `userId`; use `protectedProcedure` for user-scoped work.
- Chat: Mastra agent built **factory-style** in `src/mastra/agents/`, streamed to
  `useChat` via a route handler (slice 1). Mastra Memory uses `@mastra/pg` on the
  same `DATABASE_URL`; Drizzle only models app tables.
- `game-engine/` is a self-contained folder (own package.json + lockfile) holding
  `@learn-loop/core` and the `chemistry-lab-bench` template. It is excluded from the
  app's tsconfig and never imported in-process — the agent copies it into a sandbox
  and runs install/test/build there.
- `.agents/skills` (mirrored byte-identical to `.claude/skills`): `discovery-game-planner`,
  `experiment-lab-game`, `chemquest-lab-game`.

Slice plan: 1) chatbot (threads, streaming, memory) → 2) sandbox + skills + engine
tools + publish gate → 3) deploy.

UI: shadcn (radix-nova) + ai-elements (`conversation`, `message`, `prompt-input`,
`reasoning`, `shimmer`) in `src/components/ai-elements`; chat UI in `src/components/chat`.
Client sends only the newest user message (`prepareSendMessagesRequest`); Memory holds history.

Checks: `npm run typecheck`; `npm test` (factory tests, in-memory);
`PG_INTEGRATION=1 DATABASE_URL=... npx vitest run chats.pg` (real Postgres);
`cd game-engine && npm test` (engine).
Env: `cp .env.example .env`, `./start-database.sh` for local Postgres (port 5433 —
5432 is commonly taken on this machine).
