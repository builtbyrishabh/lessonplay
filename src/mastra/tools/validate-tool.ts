import type { Sandbox } from "@daytonaio/sdk";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { GAME_ROOT } from "~/lib/sandbox-paths";
import type { LessonTrace } from "~/mastra/agents/lesson-shared";
import { runCommand } from "~/server/sandbox/exec";
import { withRecoveredSandbox } from "~/server/sandbox/lifecycle";
import { validateScript } from "~/server/sandbox/scripts";

/** Pure functions over the authored data — fast, unlike the test+build gate. */
const VALIDATE_TIMEOUT_SECONDS = 120;
/** Exit codes from bin/validate.ts; the fix differs, so they must stay distinct. */
const EXIT_GAME_HAS_ERRORS = 1;
const EXIT_GAME_NOT_FOUND = 2;

export type CreateValidateToolOptions = {
  sandboxPromise: Promise<Sandbox>;
  /** Re-runs the full sandbox preparation if the container died. See lifecycle.ts. */
  recoverSandbox?: () => Promise<Sandbox>;
  trace?: LessonTrace;
};

/** One level's quality verdict, surfaced so the agent can fix design, not just errors. */
const levelReport = z.object({
  levelId: z.string(),
  goalKind: z.string(),
  winnable: z.boolean(),
  bruteForceable: z.boolean(),
  railed: z.boolean(),
  toolsNeeded: z.number().nullable(),
  indistinguishablePairs: z.array(z.array(z.string())),
});

/**
 * `validate` — run the engine's build-time gate over the authored game.
 *
 * Three stages, in order: the data is coherent, the level is winnable by
 * reasoning (not guessable, not railed), and the whole game plays through to a
 * win in the real session reducer. The last one is the point — everything else
 * reasons about the rules, while a learner drives the reducer.
 *
 * This is an instrument, not just a wall. `publish` runs the identical gate and
 * refuses on failure, so nothing here can be talked past; what this adds is the
 * per-level analysis mid-design, so the model can see *why* a level is weak
 * (`railed`, `toolsNeeded: 1`) while there is still time to fix the design.
 */
export function createValidateTool({
  sandboxPromise,
  recoverSandbox,
  trace,
}: CreateValidateToolOptions) {
  return createTool({
    id: "validate",
    description: [
      "Check this chat's game: that its data is coherent, that every level can be won by reasoning rather than guessing, and that the whole game plays through to a win.",
      "Fast (it reads the authored data — no install or build), so run it after writing or changing game content and before `publish`.",
      "It reports per-level quality too: a level that is `railed` or needs only one tool is winnable but boring, and worth redesigning.",
      "`publish` runs this same gate and refuses to publish if it fails.",
    ].join(" "),
    inputSchema: z.object({
      // First key on purpose: the UI narrates this while the call is still
      // streaming. Same convention as `bash` and `publish`.
      intent: z
        .string()
        .describe(
          "What this check is for, in plain language for the teacher watching. 3-8 words, e.g. 'Checking the mixtures game is winnable'.",
        ),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      errors: z.array(z.string()),
      levels: z.array(levelReport).optional(),
      message: z.string(),
    }),
    execute: async ({ intent }) => {
      const startedAt = performance.now();
      const log = trace?.log ?? (() => {});
      log("tool.validate.start", { intent });

      const fail = (message: string) => ({
        ok: false,
        errors: [] as string[],
        message,
      });

      try {
        return await withRecoveredSandbox(
          sandboxPromise,
          recoverSandbox,
          async (sandbox) => {
          const res = await runCommand(sandbox, validateScript(), {
            cwd: GAME_ROOT,
            timeoutSeconds: VALIDATE_TIMEOUT_SECONDS,
          });
          const durationMs = Math.round(performance.now() - startedAt);

          const parsed = parseReport(res.stdout);
          if (!parsed) {
            log("tool.validate.unparseable", {
              exitCode: res.exitCode,
              durationMs,
            });
            return fail(
              `The validator did not return a readable report (exit ${res.exitCode}):\n${res.stdout.slice(-2000)}`,
            );
          }

          if (res.exitCode === EXIT_GAME_NOT_FOUND) {
            log("tool.validate.not_found", { durationMs });
            return fail(
              [
                `The validator could not find the game: ${parsed.error ?? "unknown reason"}`,
                parsed.hint,
                "Nothing was checked, so do not treat this as a pass.",
              ]
                .filter(Boolean)
                .join(" "),
            );
          }

          const levels = parsed.items?.flatMap((item) => item.levels ?? []);
          const errors = parsed.errors ?? [];

          if (res.exitCode === EXIT_GAME_HAS_ERRORS || parsed.ok === false) {
            log("tool.validate.failed", { errorCount: errors.length, durationMs });
            return {
              ok: false,
              errors,
              levels,
              message: `The game is not ready: ${errors.length} problem(s) found. Fix these and run validate again.`,
            };
          }

          log("tool.validate.ok", { durationMs });
          return {
            ok: true,
            errors: [],
            levels,
            message:
              "The game is coherent, winnable by reasoning, and plays through to a win. Safe to publish.",
          };
          },
        );
      } catch (err) {
        log("tool.validate.sandbox_unavailable");
        return fail(
          `Sandbox unavailable: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });
}

type RawReport = {
  ok?: boolean;
  error?: string;
  hint?: string;
  errors?: string[];
  items?: { levels?: z.infer<typeof levelReport>[] }[];
};

/**
 * Pull the JSON report out of the command's output.
 *
 * The CLI prints only JSON, but it shares stdout with anything the imported
 * game module logs on load, so the report is found from the first `{` rather
 * than by parsing the whole stream.
 */
function parseReport(stdout: string): RawReport | null {
  const start = stdout.indexOf("{");
  if (start === -1) return null;
  try {
    return JSON.parse(stdout.slice(start)) as RawReport;
  } catch {
    return null;
  }
}
