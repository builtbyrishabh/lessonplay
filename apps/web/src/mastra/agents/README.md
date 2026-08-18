# Agents

Factory-style agents: each `create*Agent(opts)` returns a fresh `Agent` whose
tools close over per-thread state. Slice 1 files:

- `lesson-memory.ts` — Memory + storage (single place that knows the DB)
- `prompts.ts`       — system prompt builder
- `lesson-agent.ts`  — `createLessonAgent({ threadId, resourceId })`
