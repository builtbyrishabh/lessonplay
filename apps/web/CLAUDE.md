# LessonPlay web (apps/web)

T3 stack: Next.js App Router + tRPC + Drizzle (Postgres) + Clerk + Tailwind.

- Auth: Clerk. `src/middleware.ts` protects everything except `/sign-in`, `/sign-up`.
  tRPC context exposes `userId`; use `protectedProcedure` for anything user-scoped.
- Chat: Mastra agent built **factory-style** in `src/mastra/agents/`, streamed to
  `useChat` via a route handler (slice 1). Mastra Memory uses `@mastra/pg` on the
  same `DATABASE_URL`; Drizzle only models app tables.
- Slice 1 = chatbot only (threads, streaming, history). No tools/skills/engine yet —
  they plug into the factory's `tools: {}`.

Run from repo root: `npm run dev`. Env: `cp .env.example .env`, then
`./start-database.sh` for local Postgres.
