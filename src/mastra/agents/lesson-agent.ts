import type { Sandbox } from "@daytonaio/sdk";
import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import fs from "node:fs";
import path from "node:path";

import { mastra } from "~/mastra";
import { createSandboxTools } from "~/mastra/tools";
import { getLessonMemory } from "./lesson-memory";
import {
  DEFAULT_LESSON_MODEL,
  type LessonModel,
  type LessonTrace,
} from "./lesson-shared";
import { getSystemPrompt } from "./prompts";

/**
 * Game-authoring skills, handed to Mastra as filesystem paths. Mastra reads
 * each SKILL.md, injects the name+description index into the system message,
 * and supplies the `skill` / `skill_read` / `skill_search` tools — so none of
 * that is written here.
 *
 * Deliberately NOT in the sandbox snapshot: a snapshot is immutable, so a
 * skill baked into one could never be edited for threads already using it.
 * Served from the app, they version with the deploy and need no sandbox, which
 * is why the planner-only agent gets them too.
 *
 * Read once per process. `next.config.js` traces the directory into the
 * function; nothing imports it, so Next would not otherwise ship it.
 */
const SKILLS_DIR = path.resolve(process.cwd(), ".agents/skills");

const SKILL_PATHS: string[] = fs.existsSync(SKILLS_DIR)
  ? fs
      .readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() &&
          fs.existsSync(path.join(SKILLS_DIR, e.name, "SKILL.md")),
      )
      .map((e) => path.join(SKILLS_DIR, e.name))
      .sort()
  : [];

export type CreateLessonAgentOptions = {
  threadId: string;
  /** Clerk userId — used as the Memory resourceId. */
  userId: string;
  /** Gateway model id, or a model instance (tests). */
  model?: LessonModel | MastraModelConfig;
  /**
   * This thread's sandbox, still booting. Built by the caller (the route) with
   * `prepareLessonSandbox` and passed in un-awaited so boot overlaps with agent
   * assembly. Omit it — as the unit tests do — and the agent gets no sandbox
   * tools and stays a pure planner — it keeps the skill tools.
   */
  sandboxPromise?: Promise<Sandbox>;
  /**
   * Public URL this thread's published game will live at. Resolved by the
   * route because it needs `~/env`; passed down so neither this factory nor
   * anything under `tools/` has to import it.
   */
  publishedUrl?: string | null;
  trace?: LessonTrace;
};

/**
 * Factory: one fresh Agent per request.
 *
 * Everything per-thread is closed over here as `create*Tool({ ... })` entries
 * in `tools` — that closure is what lets a tool reach this thread's sandbox
 * without the model ever seeing a thread id.
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
      hasSandbox: Boolean(opts.sandboxPromise),
      publishedUrl: opts.publishedUrl,
    }),
    memory: getLessonMemory(),
    skills: SKILL_PATHS,
    tools: opts.sandboxPromise
      ? createSandboxTools({
          sandboxPromise: opts.sandboxPromise,
          publishedUrl: opts.publishedUrl,
          trace: opts.trace,
        })
      : {},
  });

  opts.trace?.log("agent.build.end", {
    durationMs: Math.round(performance.now() - startedAt),
  });

  return agent;
}
