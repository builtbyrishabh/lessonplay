# Agents (factory-style)

Each `create*Agent(opts)` returns a fresh Mastra `Agent` per request whose tools
close over per-thread state. Nothing is registered under `mastra.agents`.

| File | Owns |
| :-- | :-- |
| `lesson-agent.ts`  | `createLessonAgent({ threadId, userId, model?, sandboxPromise?, publishedUrl?, trace? })` — assembly only |
| `lesson-memory.ts` | `getLessonMemory()` — Memory on the shared PostgresStore; `resourceId` = Clerk userId |
| `lesson-shared.ts` | model allow-list + `resolveLessonModel`, `LESSON_MAX_STEPS`, `LESSON_MODEL_SETTINGS`, `LessonTrace` |
| `prompts.ts`       | `getSystemPrompt(ctx)` — the only place prompt text lives |

Skills come from `new Agent({ skills })` — the directories under `.agents/skills`,
handed to Mastra as paths. Mastra injects the name+description index into the
system message and supplies `skill` / `skill_read` / `skill_search`, so none of
that is written here. They are served by the app rather than the sandbox: a
snapshot is immutable, so a skill frozen into one could never be edited for
threads already using it. They also need no sandbox, so the planner-only agent
gets them.

Tools live in `../tools` (`createSandboxTools` → `bash` / `read` / `write` /
`edit` / `publish`), built by `create*Tool({ ... })` factories that close
over per-thread state — the model never passes a thread id, nor an R2 key. All
five share one `sandboxPromise`, an **un-awaited** `Promise<Sandbox>` the route
creates with `prepareLessonSandbox` (`~/server/sandbox/prepare`): sandbox boot,
R2 mount and the restore of the last published source overlap with agent
assembly and the first tokens, and the promise is only awaited inside
`execute`. Omit `sandboxPromise` (unit tests do) and the agent is built with no
tools and a planner-only prompt.

## Where a game lives

`~/game` is plain sandbox disk — fast enough to `npm install`, build and test
in, and lost when the sandbox is reclaimed. `~/r2` is the s3fs mount of
`games/<userId>/<threadId>/`, and the only durable thing. `publish` is the one
crossing: it runs the tests and build itself (a claim from the model is not
evidence), writes a numbered source snapshot to `versions/<n>/`, then copies
one self-contained `dist/index.html` to `current/index.html`. Snapshot first,
live file last — a transfer that dies partway leaves the previous game serving,
and the final single-object write is atomic. Version numbers are read back from
the bucket, so R2 stays the source of truth with no app state involved. Both
shell scripts live in `~/server/sandbox/scripts.ts` and are exercised against a
real bucket by `pnpm sandbox:smoke`.

Consumers:
- `src/app/api/chat/route.ts` — streaming (`agent.stream` → `toAISdkStream` → UIMessage stream), and resolves `publishedUrl` from `R2_PUBLIC_BASE_URL`
- `src/server/api/routers/chats.ts` — thread list/create/messages/delete over tRPC

Next: serve `current/index.html` in the preview pane; `getSystemPrompt` grows
the skill index and draft state.
