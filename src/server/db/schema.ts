import { pgTableCreator } from "drizzle-orm/pg-core";

/**
 * App tables are prefixed `lessonplay_`. Mastra Memory (threads/messages) owns
 * its own tables via @mastra/pg and is not modelled here.
 */
export const createTable = pgTableCreator((name) => `lessonplay_${name}`);
