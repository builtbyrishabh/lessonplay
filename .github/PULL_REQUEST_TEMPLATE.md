## What & why

<!-- What changed, and what problem it solves. Link the issue if there is one. -->

Closes #

## Checks run

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `cd game-engine && npm test`

## If this touches…

- [ ] **Skills** — `.agents/skills` and `.claude/skills` are still byte-identical (`diff -r`)
- [ ] **Agent tool schemas** — `path` / `intent` is still the first key
- [ ] **The engine** — a new snapshot was built and `DAYTONA_SNAPSHOT` updated
- [ ] **Agent behaviour** — transcript excerpt included below

## Notes for the reviewer

<!-- Screenshots for UI. Transcript excerpts for agent-behaviour changes. -->
