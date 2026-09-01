import type { Sandbox } from "@daytonaio/sdk";
import { createTool } from "@mastra/core/tools";
import { nanoid } from "nanoid";
import { z } from "zod";

import { ENGINE_ROOT, GAME_ROOT } from "~/lib/sandbox-paths";
import { runCommand } from "~/server/sandbox/exec";
import { withRecoveredSandbox } from "~/server/sandbox/lifecycle";
import type { LessonTrace } from "~/mastra/agents/lesson-shared";

/** Beyond this the output goes to a file and the model gets a pointer. */
const MAX_OUTPUT_CHARS = 20_000;
const DEFAULT_TIMEOUT_SECONDS = 60;
const MAX_TIMEOUT_SECONDS = 900;

export type CreateBashToolOptions = {
  /**
   * Not awaited at build time. The agent is assembled while the sandbox is
   * still booting/mounting; the first `bash` call pays whatever is left.
   */
  sandboxPromise: Promise<Sandbox>;
  /** Re-runs the full sandbox preparation if the container died. See lifecycle.ts. */
  recoverSandbox?: () => Promise<Sandbox>;
  /** Extra env for every command (on top of the sandbox's own envVars). */
  env?: Record<string, string>;
  trace?: LessonTrace;
};

/** Park oversized output in the sandbox so the model can grep/tail it later. */
async function spillToFile(sandbox: Sandbox, output: string): Promise<string> {
  const path = `/tmp/bash-${nanoid(10)}.log`;
  await sandbox.fs.uploadFile(Buffer.from(output, "utf-8"), path);
  return path;
}

/**
 * `bash` — run a shell command inside this thread's sandbox.
 *
 * Daytona merges stderr into stdout, so there is a single `output` field; the
 * exit code is the signal for failure. Failures are returned, not thrown, so
 * the model can read the error and retry instead of the step blowing up.
 */
export function createBashTool({
  sandboxPromise,
  recoverSandbox,
  env,
  trace,
}: CreateBashToolOptions) {
  return createTool({
    id: "bash",
    description: [
      "Run a shell command in this chat's Linux sandbox.",
      `Paths: ${GAME_ROOT} (the game project, on local disk — fast, but only durable once you call \`publish\`),`,
      `${ENGINE_ROOT} (@learn-loop/core + templates, deps already installed).`,
      `Commands run in ${GAME_ROOT} unless the command cds elsewhere.`,
      "Use for ls, cat, mkdir, cp, npm/node, running tests and builds.",
    ].join(" "),
    inputSchema: z.object({
      // Streamed first so the chat UI can narrate the step while the command
      // itself is still being generated. Keep it as the first key.
      intent: z
        .string()
        .describe(
          "What this command is for, in plain language for the teacher watching the chat. 3-8 words, present tense, no paths, flags or tool names. Examples: 'Reading the lab skill', 'Scaffolding the game project', 'Running the engine tests'.",
        ),
      command: z.string().describe("Shell command to execute"),
      timeout: z
        .number()
        .optional()
        .describe(
          `Timeout in seconds (default ${DEFAULT_TIMEOUT_SECONDS}, max ${MAX_TIMEOUT_SECONDS}). Keep it small for file pokes; raise it only for installs, builds and test runs.`,
        ),
    }),
    outputSchema: z.object({
      output: z.string(),
      exitCode: z.number(),
      durationMs: z.number(),
      truncated: z.boolean(),
      outputChars: z.number(),
      outputPath: z
        .string()
        .optional()
        .describe("Full output, saved in the sandbox; present when truncated"),
      error: z
        .string()
        .optional()
        .describe("Set when the command could not be run at all"),
    }),
    execute: async ({ command, intent, timeout }) => {
      const startedAt = performance.now();
      const timeoutSeconds = Math.min(
        timeout ?? DEFAULT_TIMEOUT_SECONDS,
        MAX_TIMEOUT_SECONDS,
      );
      trace?.log("tool.bash.start", { intent, command, timeoutSeconds });

      try {
        // The only await on the sandbox — by now it is usually already warm.
        return await withRecoveredSandbox(
          sandboxPromise,
          recoverSandbox,
          async (sandbox) => {
            const res = await runCommand(sandbox, command, {
              cwd: GAME_ROOT,
              env,
              timeoutSeconds,
            });

            const truncated = res.stdout.length > MAX_OUTPUT_CHARS;
            const outputPath = truncated
              ? await spillToFile(sandbox, res.stdout)
              : undefined;
            const durationMs = Math.round(performance.now() - startedAt);

            trace?.log("tool.bash.end", {
              command,
              exitCode: res.exitCode,
              outputChars: res.stdout.length,
              truncated,
              outputPath,
              durationMs,
            });

            return {
              output: truncated
                ? `${res.stdout.slice(0, MAX_OUTPUT_CHARS)}\n\n[truncated: ${res.stdout.length} chars total; full output at ${outputPath}]`
                : res.stdout,
              exitCode: res.exitCode,
              durationMs,
              truncated,
              outputChars: res.stdout.length,
              outputPath,
            };
          },
        );
      } catch (err) {
        // Sandbox never came up, or the SDK call itself failed. Hand the model
        // a readable failure instead of killing the step.
        const message = err instanceof Error ? err.message : String(err);
        const durationMs = Math.round(performance.now() - startedAt);
        trace?.log("tool.bash.error", { command, durationMs, error: message });
        return {
          output: "",
          exitCode: -1,
          durationMs,
          truncated: false,
          outputChars: 0,
          error: `The sandbox is unavailable: ${message}. Tell the teacher the workspace failed to start rather than pretending the command ran.`,
        };
      }
    },
  });
}
