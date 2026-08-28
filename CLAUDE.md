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
  and runs install/test/build there. The template builds to ONE self-contained
  `dist/index.html` (vite-plugin-singlefile); `publish` depends on that.
- Sandbox storage: `~/game` is local disk (build/test here) — a never-published
  thread is scaffolded from `~/engine/games/chemistry-lab-bench` by
  `scaffoldTemplateScript()` (prepare: hydrate → scaffold → node_modules link), so
  the model edits a project that already builds. `~/r2` is the s3fs
  mount of `games/<userId>/<threadId>/`. The `publish` tool is the only crossing —
  gate (validate → test+build) → `versions/<n>.tar.gz` + `versions/<n>.html` →
  atomic `current/index.html`. Each version keeps its own build, so an older one
  stays previewable; `current/` is the stable link a teacher shares.
  Scripts in `src/server/sandbox/scripts.ts`; `pnpm sandbox:smoke` runs them
  against the real bucket.
- Uploads: `/api/upload` writes `games/<userId>/<threadId>/uploads/<nanoid>-<name>`
  (same prefix, so the sandbox sees it at `~/r2/uploads/`) and returns its URL; the
  client attaches that as a `FileUIPart`, and the chat route hands the `UIMessage`
  to Mastra **as-is**. Do NOT run it through `convertToModelMessages` first: ai@7
  wraps file data in a `{ type: "url" }` union that Mastra 1.59 persists as `""`,
  so the model gets an empty file. The URL sits in Memory and the AI Gateway
  re-fetches it every turn, so it must never expire — it is the public bucket URL
  (`R2_PUBLIC_BASE_URL`; the bucket is public by key, hence the random prefix).
  Grok only takes PDFs by URL (rejects inline bytes); Muse Spark cannot read PDFs.
  `lesson-agent.live` has an attachment test — run it after bumping `ai` or Mastra.
- Publish index: `lessonplay_game_version` (Drizzle) holds one row per publish —
  metadata and bucket keys, NOT the HTML (a singlefile bundle is 0.3–1.5 MB and
  R2 already serves it). R2 still allocates version numbers, so it stays the
  source of truth and publishing works with the DB down; the row is written by a
  `recordVersion` callback the route injects, and its failure is logged, never
  fatal. Read via `games.latest` / `games.list`. This is what lets a page load
  answer "is there a game here" without booting the sandbox.
- Validation gate: `game-engine/packages/learn-loop-core/bin/validate.ts`, run via
  `validateScript()`. Three stages, each only when the last is clean — structural,
  then quality (winnable / not guessable / not railed), then **replay**: the game is
  played to a win through the real session reducer (`replayExperimentGame`,
  `replaySandboxLabMission`). The `validate` tool exposes it to the agent with the
  per-level report; `publish` runs the identical string first and refuses on
  failure, so the gate is enforced rather than asserted. It finds the game via
  `lessonplay: { entry, export }` in the game's package.json, and exits 0 / 1 (game
  has errors) / 2 (game not found) — never 0 on a game it could not read.
- `.agents/skills` (mirrored byte-identical to `.claude/skills`): `discovery-game-planner`,
  `experiment-lab-game`, `chemquest-lab-game`. Served by the app, NOT the sandbox —
  passed to `new Agent({ skills })` as filesystem paths, so Mastra injects the index
  into the system message and supplies `skill` / `skill_read` / `skill_search` itself.
  Edits ship with a deploy instead of needing a new (immutable) snapshot;
  `next.config.js` traces the directory into the function.
  `experiment-lab-game/references/implementation-pattern.md` is the starter's
  layout and the five files an experiment game changes; the system prompt says the
  tree is scaffolded and forbids exploring `~/engine`. If the model starts
  `find`ing or grepping engine source again, a reference is missing something —
  document it in the skill, don't loosen the prompt.

Slice plan: 1) chatbot (threads, streaming, memory) → 2) sandbox + skills + engine
tools + publish gate → 3) deploy.

UI: ported from Vercel's v0-clone (`create-v0-sdk-app -e v0-clone`) onto shadcn (radix-nova)
+ ai-elements. Geist font + geist-icons only (`src/lib/icons.ts`), next-themes.
- `src/app/(app)/` — route group wrapped in `AppShell` (collapsible sidebar); sign-in/up stay bare.
- `components/layout/` app-shell, sidebar (tRPC `chats.list`), chat-item (rename/delete)
- `components/home/home-client.tsx` — landing prompt; creates a thread, hands the first
  prompt off via sessionStorage (`lib/pending-prompt.ts`), navigates to `/chats/[id]`
- `components/chat/` chat-provider (owns `useChat` for BOTH panes), chat-workspace
  (v0 split layout), chat-header (share link), chat-conversation, message-parts,
  tool-call (renders every `tool-*` part), workspace-pane (Preview | Code),
  game-preview (versioned iframe), code-view; `components/prompt-box.tsx`
- The code pane derives its files from `write`/`edit` tool inputs in the message
  stream (`lib/game-files.ts`) — Mastra streams partial tool JSON, and `path` /
  `intent` are the FIRST key in every tool's input schema on purpose, so the UI
  can name a call and type a file out while the arguments are still arriving.
  Keep that key order when adding a tool.
- The conversation folds consecutive `write`/`edit` calls into one `BuildBlock`
  (`chat/build-block.tsx`) that types the active file inline and collapses to a
  count when done — no per-file rows; consecutive `read`s fold into a `ReadGroup`.
  `step-start` parts are transparent to that grouping (`lib/message-groups.ts`).
Client sends only the newest user message (`prepareSendMessagesRequest`); Memory holds history.
Model choice lives in localStorage (`lib/hooks/use-settings.ts`) and is sent in the body.

Checks: `pnpm typecheck`; `pnpm test` (factory tests, in-memory);
`pnpm sandbox:smoke` (live Daytona + R2: mount → publish → hydrate);
`PG_INTEGRATION=1 DATABASE_URL=... npx vitest run chats.pg` (real Postgres);
`cd game-engine && npm test` (engine).
Sandbox base image (`~/engine` + s3fs only): `pnpm snapshot:build <name>` (idempotent —
reuses an existing snapshot). Snapshots are immutable, so engine changes need a NEW
name; set `DAYTONA_SNAPSHOT` to it. Existing thread sandboxes keep the snapshot they
were born from. Current: `lessonplay-base-v4`.
Env: `cp .env.example .env`, `./start-database.sh` for local Postgres (port 5433 —
5432 is commonly taken on this machine).
