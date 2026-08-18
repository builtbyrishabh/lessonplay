# Agents (factory-style)

Each `create*Agent(opts)` returns a fresh Mastra `Agent` per request whose tools
close over per-thread state. Nothing is registered under `mastra.agents`.

| File | Owns |
| :-- | :-- |
| `lesson-agent.ts`  | `createLessonAgent({ threadId, userId, model?, trace? })` — assembly only |
| `lesson-memory.ts` | `getLessonMemory()` — Memory on the shared PostgresStore; `resourceId` = Clerk userId |
| `lesson-shared.ts` | model allow-list + `resolveLessonModel`, `LESSON_MAX_STEPS`, `LESSON_MODEL_SETTINGS`, `LessonTrace` |
| `prompts.ts`       | `getSystemPrompt(ctx)` — the only place prompt text lives |

Consumers:
- `src/app/api/chat/route.ts` — streaming (`agent.stream` → `toAISdkStream` → UIMessage stream)
- `src/server/api/routers/chats.ts` — thread list/create/messages/delete over tRPC

Slice 2 adds `tools: { ...create*Tool({ threadId }) }` in `lesson-agent.ts` and
extends `getSystemPrompt` with skills/draft state. Nothing else should change.
