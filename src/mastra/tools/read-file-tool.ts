import type { Sandbox } from "@daytonaio/sdk";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { ENGINE_ROOT, expandSandboxPath, GAME_ROOT } from "~/lib/sandbox-paths";
import type { LessonTrace } from "~/mastra/agents/lesson-shared";
import { withRecoveredSandbox } from "~/server/sandbox/lifecycle";

/** Above this, downloading the whole file into the server is wasteful — `bash` with head/grep is the right tool. */
const MAX_FILE_BYTES = 2_000_000;
/** Above this we truncate the text handed to the model. */
const MAX_CHARS = 40_000;
const MAX_DIR_ENTRIES = 200;

export type CreateReadFileToolOptions = {
  sandboxPromise: Promise<Sandbox>;
  /** Re-runs the full sandbox preparation if the container died. See lifecycle.ts. */
  recoverSandbox?: () => Promise<Sandbox>;
  trace?: LessonTrace;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** NUL bytes in the first chunk is the usual cheap heuristic for "not text". */
function looksBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, 8_000).includes(0);
}

function sliceLines(text: string, offset?: number, limit?: number): string {
  if (offset === undefined && limit === undefined) return text;
  const lines = text.split("\n");
  const start = Math.max((offset ?? 1) - 1, 0);
  return lines.slice(start, limit ? start + limit : undefined).join("\n");
}

/**
 * `read` — a text file, or a directory listing.
 *
 * `bash cat` can do this too; this exists because the result comes back as
 * structured output (path + size + content) instead of raw shell output, and
 * because size/binary guards stop a stray `cat` on a bundle from flooding the
 * context window.
 */
export function createReadFileTool({
  sandboxPromise,
  recoverSandbox,
  trace,
}: CreateReadFileToolOptions) {
  return createTool({
    id: "read",
    description: `Read a text file, or list a directory. Paths may be absolute (/home/daytona/...), "~/..." , or relative to ${GAME_ROOT}. Use it on engine sources (${ENGINE_ROOT}) and game files. Skills are not files — read them with the \`skill\` tool. For huge or binary files, or for searching across many files, use bash instead.`,
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          `File or directory path (e.g. "${ENGINE_ROOT}/games/chemistry-lab-bench/src/main.tsx", "src/scenario.ts")`,
        ),
      offset: z
        .number()
        .optional()
        .describe("1-based line to start from. Omit to read from the top."),
      limit: z
        .number()
        .optional()
        .describe("How many lines to read from `offset`."),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      path: z.string(),
      kind: z.enum(["file", "directory"]).optional(),
      size: z
        .number()
        .optional()
        .describe("Bytes for a file, entry count for a directory"),
      content: z.string().optional(),
      truncated: z.boolean().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ path: input, offset, limit }) => {
      const path = expandSandboxPath(input);
      try {
        return await withRecoveredSandbox(
          sandboxPromise,
          recoverSandbox,
          async (sandbox) => {
            const details = await sandbox.fs.getFileDetails(path);

            if (details.isDir) {
              const entries = await sandbox.fs.listFiles(path);
              const shown = entries.slice(0, MAX_DIR_ENTRIES);
              trace?.log("tool.read.dir", { path, entries: entries.length });
              return {
                ok: true,
                path,
                kind: "directory" as const,
                size: entries.length,
                truncated: entries.length > shown.length,
                content: shown
                  .map((e) => (e.isDir ? `${e.name}/` : `${e.name}  (${e.size} B)`))
                  .join("\n"),
              };
            }

            if (details.size > MAX_FILE_BYTES) {
              return {
                ok: false,
                path,
                error: `File is ${details.size} bytes, too large to read whole. Use bash with head/tail/grep to pull out the part you need.`,
              };
            }

            const buffer = await sandbox.fs.downloadFile(path);
            if (looksBinary(buffer)) {
              return {
                ok: false,
                path,
                kind: "file" as const,
                size: details.size,
                error:
                  "This is a binary file, so there is nothing readable to return. Describe it to the teacher by name/size instead of trying to read it.",
              };
            }

            const text = sliceLines(buffer.toString("utf-8"), offset, limit);
            const truncated = text.length > MAX_CHARS;
            trace?.log("tool.read.file", {
              path,
              bytes: details.size,
              truncated,
            });
            return {
              ok: true,
              path,
              kind: "file" as const,
              size: details.size,
              truncated,
              content: truncated
                ? `${text.slice(0, MAX_CHARS)}\n\n[truncated — re-read with offset/limit, or use bash grep to find the part you need]`
                : text,
            };
          },
        );
      } catch (err) {
        const message = errorMessage(err);
        trace?.log("tool.read.error", { path, error: message });
        return {
          ok: false,
          path,
          error: `Could not read "${input}": ${message}. Check the path with bash (\`ls\`) before retrying.`,
        };
      }
    },
  });
}
