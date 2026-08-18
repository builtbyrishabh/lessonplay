import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

import { env } from "~/env";

/**
 * Shared storage for Mastra Memory (threads/messages) and, later, workflows.
 * Same DATABASE_URL as Drizzle; Mastra owns its own tables (mastra_*).
 */
export const storage = new PostgresStore({
  id: "lessonplay-storage",
  connectionString: env.DATABASE_URL,
});

/**
 * Shared Mastra container (DI root).
 *
 * Agents are deliberately NOT registered under `agents: {}`. They are built
 * per-request by factories in ./agents (e.g. createLessonAgent) so their tools
 * can close over per-thread state; each factory passes `mastra` into
 * `new Agent({ mastra })` so storage / logger / observability still cascade.
 */
export const mastra = new Mastra({
  agents: {},
  storage,
});
