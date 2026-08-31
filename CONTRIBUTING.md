# Contributing to LessonPlay

Thanks for being here. This project is early and the surface area is unusual —
an AI agent writing code inside a sandbox — so this document front-loads the
things that are genuinely surprising rather than restating generic Git advice.

## Getting set up

```bash
pnpm install
cp .env.example .env
./start-database.sh       # local Postgres on 5433 (5432 is usually taken)
pnpm db:push
pnpm dev
```

**You do not need every key to contribute.** The full test suite and the public
homepage run with no external services at all. Reach for keys only when your
change needs that surface:

| Working on | Keys you need |
| --- | --- |
| Homepage, UI, engine, validator, tests | none |
| Chat and agent behaviour | Clerk + `AI_GATEWAY_API_KEY` + `DATABASE_URL` |
| Sandbox, build, publish | the above + Daytona + R2 |

## Before you open a PR

```bash
pnpm typecheck
pnpm test
cd game-engine && npm test
```

All three must pass. CI runs exactly these.

## Things that will surprise you

Please read these before touching the relevant area — each one is a deliberate
design decision that looks like a bug.

**`game-engine/` is not part of the app.** It has its own `package.json` and
lockfile, is excluded from the app's `tsconfig`, and is never imported
in-process. The agent copies it into a sandbox and installs it there. If you
find yourself adding `import { … } from "~/../game-engine/…"`, stop — that seam
is intentional.

**`.agents/skills` and `.claude/skills` are byte-identical mirrors.** Edit one
and you must edit the other. Verify with:

```bash
diff -r .agents/skills .claude/skills && echo "in sync"
```

**Tool input schemas have a deliberate key order.** `path` (or `intent`) is the
*first* key in every agent tool's input schema. Mastra streams partial tool
JSON, and the UI names a call and types out a file while the arguments are still
arriving. Reordering those keys silently breaks the code pane. See
`src/lib/game-files.ts`.

**Don't run `UIMessage`s through `convertToModelMessages`.** `ai@7` wraps file
data in a `{ type: "url" }` union that Mastra persists as `""`, so the model
receives an empty file. The chat route hands the message to Mastra as-is. There
is an attachment test in `lesson-agent.live` — run it after bumping `ai` or
Mastra.

**Sandbox snapshots are immutable.** Engine changes need a *new* snapshot name
(`pnpm snapshot:build <name>`) and a matching `DAYTONA_SNAPSHOT`. Existing
thread sandboxes keep the snapshot they were born from.

**If the agent starts exploring `~/engine`, a skill reference is incomplete.**
The system prompt forbids it because the tree is already scaffolded. The fix is
to document the missing thing in the skill — not to loosen the prompt.

## Where help is most useful

- **New game templates.** The engine is domain-agnostic by design; only the
  template and skills are chemistry-specific. Physics and biology are wide open.
- **Validator rules.** The gate is the project's core value. Every bad-game
  pattern it learns to catch makes the whole thing more trustworthy.
- **Skill references.** Better references mean less agent flailing and cheaper,
  faster builds.

## Commit and PR style

Conventional-ish commits, scoped to the area:

```
feat(marketing): public homepage at /
fix(sandbox): archive stopped sandboxes after 60m to reclaim disk
```

In the PR, say what changed and *why*, and note which of the three check
commands you ran. If your change touches the agent's behaviour, include a
transcript excerpt — behaviour changes are hard to review from a diff alone.

## Reporting bugs

Use the issue templates. For anything security-related, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

By contributing you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE).
