# LessonPlay

Give it a chemistry chapter. Get a playable lab.

## Layout

```
apps/web/     T3 app (Next.js + tRPC + Drizzle/Postgres + Clerk) — Mastra chat agent (factory-style) + UI
packages/     @learn-loop/core — shared Learn Loop engine and lab UI
games/        chemistry-lab-bench — minimal reference template
.agents/      Chemistry game-design skills (mirrored to .claude/skills)
```

## Run

```bash
npm install
cp apps/web/.env.example apps/web/.env      # Clerk keys, DATABASE_URL, AI_GATEWAY_API_KEY
(cd apps/web && ./start-database.sh)        # local Postgres via Docker
npm run dev
```

## Verify

```bash
npm test && npm run typecheck
```
