import type { Sandbox } from "@daytonaio/sdk";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { expandSandboxPath } from "~/lib/sandbox-paths";
import type { LessonTrace } from "~/mastra/agents/lesson-shared";

export type CreateEditFileToolOptions = {
  sandboxPromise: Promise<Sandbox>;
  trace?: LessonTrace;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * `edit` — replace an exact string in a file.
 *
 * Download → replace in JS → upload. Every failure mode (missing file, no
 * match, ambiguous match) comes back as `ok: false` with an instruction,
 * because the model can act on those; an exception it can only apologise for.
 */
export function createEditFileTool({
  sandboxPromise,
  trace,
}: CreateEditFileToolOptions) {
  return createTool({
    id: "edit",
    description:
      "Edit a text file by replacing an exact string. `old_string` must match the file exactly — whitespace and indentation included — and must be unique unless `replace_all` is true. Read the file first and copy the text you intend to replace. Use write to create a file or replace it wholesale.",
    inputSchema: z.object({
      path: z.string().describe("File to edit"),
      old_string: z.string().describe("Exact existing text to replace"),
      new_string: z
        .string()
        .describe("Replacement text (must differ from old_string)"),
      replace_all: z
        .boolean()
        .optional()
        .describe("Replace every occurrence (default false)"),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      path: z.string(),
      replacements: z.number().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ path: input, old_string, new_string, replace_all }) => {
      const path = expandSandboxPath(input);

      if (old_string === new_string) {
        return {
          ok: false,
          path,
          error:
            "old_string and new_string are identical, so this edit would change nothing. Provide a new_string that differs.",
        };
      }

      try {
        const sandbox = await sandboxPromise;

        const details = await sandbox.fs.getFileDetails(path).catch(() => null);
        if (!details || details.isDir) {
          return {
            ok: false,
            path,
            error: `No file at "${input}". Check the path, or use write to create it.`,
          };
        }

        const content = (await sandbox.fs.downloadFile(path)).toString("utf-8");
        const occurrences = content.split(old_string).length - 1;

        if (occurrences === 0) {
          return {
            ok: false,
            path,
            error: `old_string was not found in "${input}". Read the file and copy the exact text — including indentation — you want to replace.`,
          };
        }
        if (occurrences > 1 && !replace_all) {
          return {
            ok: false,
            path,
            error: `old_string matches ${occurrences} times in "${input}", so the edit is ambiguous. Add surrounding context to make it unique, or set replace_all=true.`,
          };
        }

        const updated = replace_all
          ? content.split(old_string).join(new_string)
          : content.replace(old_string, new_string);
        await sandbox.fs.uploadFile(Buffer.from(updated, "utf-8"), path);

        const replacements = replace_all ? occurrences : 1;
        trace?.log("tool.edit", { path, replacements });
        return { ok: true, path, replacements };
      } catch (err) {
        const message = errorMessage(err);
        trace?.log("tool.edit.error", { path, error: message });
        return {
          ok: false,
          path,
          error: `Failed to edit "${input}": ${message}.`,
        };
      }
    },
  });
}
