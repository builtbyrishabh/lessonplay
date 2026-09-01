import type { Sandbox } from "@daytonaio/sdk";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { GAME_ROOT, PUBLISHED_FILE } from "~/lib/sandbox-paths";
import type { LessonTrace } from "~/mastra/agents/lesson-shared";
import { runCommand } from "~/server/sandbox/exec";
import { withRecoveredSandbox } from "~/server/sandbox/lifecycle";
import { publishScript, validateScript } from "~/server/sandbox/scripts";

/** Tests plus build. Long, because a cold vite build is not quick. */
const GATE_TIMEOUT_SECONDS = 600;
/** Pure functions over the authored data; nothing here installs or compiles. */
const VALIDATE_TIMEOUT_SECONDS = 120;
/** Exit code from bin/validate.ts meaning the game could not be located at all. */
const EXIT_GAME_NOT_FOUND = 2;
const COPY_TIMEOUT_SECONDS = 180;
/** Enough of a failing build for the model to act on, not enough to drown it. */
const MAX_GATE_OUTPUT_CHARS = 6_000;

export type CreatePublishToolOptions = {
  sandboxPromise: Promise<Sandbox>;
  /** Re-runs the full sandbox preparation if the container died. See lifecycle.ts. */
  recoverSandbox?: () => Promise<Sandbox>;
  /**
   * Public URL of the published file, precomputed by the caller from
   * `publishedGameKey`. Null when R2_PUBLIC_BASE_URL is unset — publishing
   * still works, the model just reports the key instead of a link.
   */
  publishedUrl?: string | null;
  /**
   * Called after R2 has the new version, to index it for the app.
   *
   * A callback rather than a database import on purpose: it keeps this module
   * free of `~/env` and `~/server/db`, so the whole tool set stays unit-testable
   * against a fake sandbox. The route supplies the real one.
   *
   * Its failure is swallowed — see the call site. R2 is the source of truth;
   * a missing row is a stale index, not a lost game.
   */
  recordVersion?: (published: {
    version: number;
    label: string;
  }) => Promise<void>;
  trace?: LessonTrace;
};

function tail(output: string): string {
  return output.length > MAX_GATE_OUTPUT_CHARS
    ? `…\n${output.slice(-MAX_GATE_OUTPUT_CHARS)}`
    : output;
}

/**
 * `publish` — validate the game, then copy it into R2.
 *
 * The gate runs here rather than being asserted by the model: "tests passed"
 * is a claim, and this tool is the thing that has to be true. Likewise the
 * destination key is never an input — the model cannot name a path in the
 * bucket, only ask for this thread's game to be published.
 */
export function createPublishTool({
  sandboxPromise,
  recoverSandbox,
  publishedUrl,
  recordVersion,
  trace,
}: CreatePublishToolOptions) {
  return createTool({
    id: "publish",
    description: [
      "Validate this chat's game and publish it for the teacher.",
      `Validates the game, then runs \`npm test\` and \`npm run build\` in ${GAME_ROOT}, and refuses to publish if any of them fails.`,
      "On success it saves a numbered source snapshot and replaces the live game with the new build.",
      "Call it once the game works; nothing in the sandbox is durable until you do.",
    ].join(" "),
    inputSchema: z.object({
      // First key on purpose: the UI narrates this while the call is still
      // streaming. Same convention as `bash`.
      intent: z
        .string()
        .describe(
          "One short sentence for the teacher, e.g. 'Publishing the titration lab'.",
        ),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      version: z.number().nullable(),
      url: z.string().nullable(),
      key: z.string().nullable(),
      message: z.string(),
    }),
    execute: async ({ intent }) => {
      const log = trace?.log ?? (() => {});
      const startedAt = performance.now();
      log("tool.publish.start", { intent });

      const fail = (message: string) => ({
        ok: false,
        version: null,
        url: null,
        key: null,
        message,
      });

      try {
        return await withRecoveredSandbox(
          sandboxPromise,
          recoverSandbox,
          async (sandbox) => {
          // The engine's own gate, first and by absolute path out of ~/engine.
          // It is seconds rather than minutes, so a game that cannot be finished
          // fails here instead of after a cold vite build. It also runs on data the
          // model cannot reach: `npm test` is a file in the working tree, and the
          // model owns that file — "the tests passed" only means what the tests
          // happen to assert today.
          const validated = await runCommand(sandbox, validateScript(), {
            cwd: GAME_ROOT,
            timeoutSeconds: VALIDATE_TIMEOUT_SECONDS,
          });
          if (!validated.success) {
            log("tool.publish.validate_failed", { exitCode: validated.exitCode });
            // Never publish a game the gate could not read. A validator that passes
            // when it finds nothing would certify an unplayable game.
            const preamble =
              validated.exitCode === EXIT_GAME_NOT_FOUND
                ? "Not published — the validator could not find this game's data, so nothing was checked."
                : "Not published — the game did not pass validation.";
            return fail(`${preamble} Fix this and call publish again:\n${tail(validated.stdout)}`);
          }
          log("tool.publish.validated", {
            durationMs: Math.round(performance.now() - startedAt),
          });

          const gate = await runCommand(
            sandbox,
            "npm test --silent && npm run build --silent",
            { cwd: GAME_ROOT, timeoutSeconds: GATE_TIMEOUT_SECONDS },
          );
          if (!gate.success) {
            log("tool.publish.gate_failed", { exitCode: gate.exitCode });
            return fail(
              `Not published — tests or build failed (exit ${gate.exitCode}). Fix this and call publish again:\n${tail(gate.stdout)}`,
            );
          }
          log("tool.publish.gate_passed", {
            durationMs: Math.round(performance.now() - startedAt),
          });

          const res = await runCommand(sandbox, publishScript(), {
            timeoutSeconds: COPY_TIMEOUT_SECONDS,
          });
          const out = res.stdout.trim();

          if (!res.success) {
            log("tool.publish.copy_failed", { exitCode: res.exitCode });
            if (out.startsWith("NO_BUILD")) {
              return fail(
                `The build succeeded but ${GAME_ROOT}/dist/${PUBLISHED_FILE} is missing. Check the build's output directory.`,
              );
            }
            if (out.startsWith("NOT_SELF_CONTAINED")) {
              return fail(
                `dist/ holds files besides ${PUBLISHED_FILE}, so the game would load assets that are not published:\n${out}\n` +
                  "The build must inline everything into one HTML file — check vite-plugin-singlefile is enabled in vite.config.ts.",
              );
            }
            // The published file is written last, so the live game is untouched.
            return fail(
              `Publish failed (exit ${res.exitCode}); the previously published game is unchanged:\n${tail(out)}`,
            );
          }

          const version = Number(out.split("\n").pop()?.replace("PUBLISHED ", ""));
          log("tool.publish.ok", {
            version,
            durationMs: Math.round(performance.now() - startedAt),
          });

          // Index the new version for the app. Deliberately after the bucket write
          // and deliberately non-fatal: the game IS published at this point, and
          // telling the model otherwise would send it round the whole gate again to
          // fix a database it cannot reach. A dropped row costs the version list
          // one entry; the game itself is still live and the next publish indexes
          // normally.
          if (recordVersion && Number.isFinite(version)) {
            try {
              await recordVersion({ version, label: intent });
            } catch (err) {
              log("tool.publish.record_failed", {
                version,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }

          return {
            ok: true,
            version: Number.isFinite(version) ? version : null,
            url: publishedUrl ?? null,
            key: publishedUrl ? null : `current/${PUBLISHED_FILE}`,
            message: publishedUrl
              ? `Published version ${version}. The teacher can play it at ${publishedUrl}.`
              : `Published version ${version}. No public URL is configured yet, so share it once R2_PUBLIC_BASE_URL is set.`,
          };
          },
        );
      } catch (err) {
        log("tool.publish.sandbox_unavailable");
        return fail(
          `Sandbox unavailable: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });
}
