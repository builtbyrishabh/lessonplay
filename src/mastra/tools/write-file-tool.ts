import type { Sandbox } from "@daytonaio/sdk";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { expandSandboxPath, GAME_ROOT } from "~/lib/sandbox-paths";
import type { LessonTrace } from "~/mastra/agents/lesson-shared";
import { quoteShellArg, runCommand } from "~/server/sandbox/exec";

function parentDir(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

export type CreateWriteFileToolOptions = {
  sandboxPromise: Promise<Sandbox>;
  trace?: LessonTrace;
};

/**
 * `write` — create or overwrite a file, parents included.
 *
 * The content travels as a byte buffer through `fs.uploadFile`, never through a
 * shell. That is the whole point: a heredoc would make the model responsible
 * for escaping `$`, backticks and quotes inside TSX/JSON, and it gets that
 * wrong silently.
 */
export function createWriteFileTool({
  sandboxPromise,
  trace,
}: CreateWriteFileToolOptions) {
  return createTool({
    id: "write",
    description: `Write a file, creating parent directories and overwriting any existing file. Content is written verbatim — no shell escaping needed, so prefer this over \`bash cat <<EOF\` for any code or config. Paths may be absolute, "~/...", or relative to ${GAME_ROOT}. For a small change to an existing file, use edit.`,
    inputSchema: z.object({
      path: z.string().describe(`File path (e.g. "src/scenario.ts")`),
      content: z.string().describe("Full file content"),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      path: z.string(),
      bytesWritten: z.number().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ path: input, content }) => {
      const path = expandSandboxPath(input);
      try {
        const sandbox = await sandboxPromise;

        const dir = parentDir(path);
        const mkdir = await runCommand(
          sandbox,
          `mkdir -p ${quoteShellArg(dir)}`,
        );
        if (!mkdir.success) {
          return {
            ok: false,
            path,
            error: `Could not create parent directory "${dir}" (exit ${mkdir.exitCode}): ${mkdir.stdout.trim() || "no output"}. Check the path is valid and writable.`,
          };
        }

        const buffer = Buffer.from(content, "utf-8");
        await sandbox.fs.uploadFile(buffer, path);
        trace?.log("tool.write", { path, bytes: buffer.byteLength });

        return { ok: true, path, bytesWritten: buffer.byteLength };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        trace?.log("tool.write.error", { path, error: message });
        return {
          ok: false,
          path,
          error: `Failed to write "${input}": ${message}. Verify the path is a writable sandbox path and try again.`,
        };
      }
    },
  });
}
