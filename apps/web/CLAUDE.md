# LessonPlay web (apps/web)

Next.js App Router product for LessonPlay. Chat is a Mastra agent built
**factory-style** (`src/mastra/agents/lesson-agent.ts`) and streamed to
`useChat` through `src/app/api/chat/route.ts`.

Slice 1 = chatbot only: threads, streaming, persistent history. No tools, auth,
skills, or engine integration yet — those plug into the factory's `tools: {}`.

Run from repo root: `npm run dev`. Env: copy `.env.example` → `.env`.
