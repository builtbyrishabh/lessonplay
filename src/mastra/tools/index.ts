import type { Sandbox } from "@daytonaio/sdk";

import type { LessonTrace } from "~/mastra/agents/lesson-shared";
import { createBashTool } from "./bash-tool";
import { createEditFileTool } from "./edit-file-tool";
import { createPublishTool } from "./publish-tool";
import { createReadFileTool } from "./read-file-tool";
import { createValidateTool } from "./validate-tool";
import { createWriteFileTool } from "./write-file-tool";

export type SandboxToolOptions = {
  /** Un-awaited on purpose — see `~/server/sandbox/prepare`. */
  sandboxPromise: Promise<Sandbox>;
  /**
   * Where this thread's published game will be readable. Computed by the
   * caller (it needs env) and handed down, so nothing under `tools/` has to
   * import `~/env` and the whole set stays unit-testable.
   */
  publishedUrl?: string | null;
  /** Extra env for `bash` commands. */
  env?: Record<string, string>;
  trace?: LessonTrace;
};

/**
 * The sandbox tool set. One `sandboxPromise` shared by all six, so whichever
 * runs first pays the boot wait and the rest are free.
 */
export function createSandboxTools(opts: SandboxToolOptions) {
  return {
    bash: createBashTool(opts),
    read: createReadFileTool(opts),
    write: createWriteFileTool(opts),
    edit: createEditFileTool(opts),
    validate: createValidateTool(opts),
    publish: createPublishTool(opts),
  };
}
