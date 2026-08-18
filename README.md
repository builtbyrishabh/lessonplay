# LessonPlay

Give it a chemistry chapter. Get a playable lab.

T3 app (Next.js + tRPC + Drizzle/Postgres + Clerk + Tailwind) with a Mastra chat
agent. The game engine lives in `game-engine/` and is **not** part of the app's
dependency graph — it is copied into a sandbox and installed there.

## Layout

```
src/                  Next.js App Router, tRPC, Drizzle, Mastra agents (src/mastra)
game-engine/          Self-contained: @learn-loop/core engine + chemistry-lab-bench template
                      (own package.json/lockfile; `cd game-engine && pnpm install && pnpm test`)
.agents/skills/       Chemistry game-design skills (mirrored to .claude/skills)
```

## Run

```bash
pnpm install
cp .env.example .env      # Clerk keys, DATABASE_URL, AI_GATEWAY_API_KEY
./start-database.sh       # local Postgres via Docker
pnpm dev
```

## Verify

```bash
pnpm typecheck                                  # app
cd game-engine && pnpm install && pnpm test          # engine (standalone)
```
