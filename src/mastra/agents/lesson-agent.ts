import { Agent } from "@mastra/core/agent";

import { mastra } from "~/mastra";
import { getLessonMemory } from "./lesson-memory";
import {
  DEFAULT_LESSON_MODEL,
  type LessonModel,
  type LessonTrace,
} from "./lesson-shared";
import { getSystemPrompt } from "./prompts";

export type CreateLessonAgentOptions = {
  threadId: string;
  /** Clerk userId — used as the Memory resourceId. */
  userId: string;
  model?: LessonModel;
  trace?: LessonTrace;
};

/**
 * Factory: one fresh Agent per request.
 *
 * Everything per-thread (later: virtual project files, publish gate, sandbox)
 * is closed over here as `create*Tool({ threadId, ... })` entries in `tools`.
 * Slice 1 ships with no tools.
 */
export async function createLessonAgent(opts: CreateLessonAgentOptions) {
  const startedAt = performance.now();
  opts.trace?.log("agent.build.start", { threadId: opts.threadId });

  const currentDateTime = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const agent = new Agent({
    id: "lesson-agent",
    name: "LessonPlay",
    // Attaches the shared container so storage/logger/observability cascade.
    mastra,
    model: opts.model ?? DEFAULT_LESSON_MODEL,
    instructions: getSystemPrompt({
      userId: opts.userId,
      threadId: opts.threadId,
      currentDateTime,
    }),
    memory: getLessonMemory(),
    tools: {},
  });

  opts.trace?.log("agent.build.end", {
    durationMs: Math.round(performance.now() - startedAt),
  });

  return agent;
}
