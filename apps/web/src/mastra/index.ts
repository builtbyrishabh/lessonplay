// Shared Mastra container (DI root). Agents are built per-request via factories
// (see ./agents/lesson-agent.ts) rather than registered under `agents`, so this
// singleton only carries the shared infra that should cascade to them.
export {};
