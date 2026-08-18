// Shared Mastra container (DI root). Agents are built per-request via factories
// (see ./agents/) rather than registered under `agents`, so this singleton only
// carries shared infra (storage, logger, observability) that should cascade.
export {};
