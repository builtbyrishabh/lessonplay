# Agents (factory-style)

Each `create*Agent(opts)` returns a fresh Mastra `Agent` whose tools close over
per-thread state. Slice 1 files:

- `lesson-memory.ts` — Memory + PostgresStore (single place that knows the DB)
- `prompts.ts`       — system prompt builder
- `lesson-agent.ts`  — `createLessonAgent({ threadId, userId })`
