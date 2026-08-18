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

UI: ported from Vercel's v0-clone (`create-v0-sdk-app -e v0-clone`) onto shadcn (radix-nova)
+ ai-elements. Geist font + geist-icons only (`src/lib/icons.ts`), next-themes.
- `src/app/(app)/` — route group wrapped in `AppShell` (collapsible sidebar); sign-in/up stay bare.
- `components/layout/` app-shell, sidebar (tRPC `chats.list`), chat-item (rename/delete)
- `components/home/home-client.tsx` — landing prompt; creates a thread, hands the first
  prompt off via sessionStorage (`lib/pending-prompt.ts`), navigates to `/chats/[id]`
- `components/chat/` chat-workspace (v0 split layout; right pane reserved for game preview),
  chat-header, chat-conversation (`useChat`), message-parts; `components/prompt-box.tsx`
Client sends only the newest user message (`prepareSendMessagesRequest`); Memory holds history.
Model choice lives in localStorage (`lib/hooks/use-settings.ts`) and is sent in the body.

Checks: `pnpm typecheck`; `pnpm test` (factory tests, in-memory);
`PG_INTEGRATION=1 DATABASE_URL=... npx vitest run chats.pg` (real Postgres);
`cd game-engine && npm test` (engine).
Env: `cp .env.example .env`, `./start-database.sh` for local Postgres (port 5433 —
5432 is commonly taken on this machine).
