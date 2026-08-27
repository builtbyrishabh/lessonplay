import "server-only";

import type { Sandbox } from "@daytonaio/sdk";

import { GAME_ROOT, sandboxIdForThread } from "~/lib/sandbox-paths";
import type { LessonTrace } from "~/mastra/agents/lesson-shared";
import { getOrCreateSandbox } from "./daytona";
import { runCommand } from "./exec";
import { mountR2Bucket } from "./r2-mount";
import { hydrateScript, linkEngineModulesScript } from "./scripts";

/** Env baked into the sandbox at create time. Empty for now. */
const SANDBOX_ENV: Record<string, string> = {};

async function hydrateWorkingTree(
  sandbox: Sandbox,
  log: (event: string, data?: Record<string, unknown>) => void,
): Promise<void> {
  const res = await runCommand(sandbox, hydrateScript(), {
    timeoutSeconds: 120,
  });

  const state = res.stdout.trim().split("\n").pop() ?? "";
  log("sandbox.hydrate", { state, ok: res.success });
  if (!res.success) {
    // A failed restore leaves a half-copied tree, which is worse than none.
    await runCommand(sandbox, `rm -rf ${GAME_ROOT} && mkdir -p ${GAME_ROOT}`);
    throw new Error(
      `[LessonPlay] hydrate failed (exit ${res.exitCode}): ${res.stdout.slice(-1000)}`,
    );
  }

  // Strictly after the restore — see linkEngineModulesScript.
  const link = await runCommand(sandbox, linkEngineModulesScript());
  log("sandbox.engine_modules", {
    state: link.stdout.trim().split("\n").pop(),
    ok: link.success,
  });
}

/**
 * Start (or resume) this thread's sandbox, mount its R2 prefix at ~/r2, and
 * restore the last published source into ~/game.
 *
 * Returns the promise WITHOUT awaiting it: the caller hands it to the tools and
 * carries on building the agent, so all of this overlaps with prompt assembly
 * and the model's first token. Idempotent — safe on every request.
 */
export function prepareLessonSandbox(opts: {
  threadId: string;
  userId: string;
  trace?: LessonTrace;
}): Promise<Sandbox> {
  const startedAt = performance.now();
  const log = opts.trace?.log ?? (() => {});

  const promise = (async () => {
    const { sandbox, status } = await getOrCreateSandbox(
      sandboxIdForThread(opts.threadId),
      { env: SANDBOX_ENV },
    );
    log("sandbox.acquired", {
      status,
      id: sandbox.id,
      durationMs: Math.round(performance.now() - startedAt),
    });

    await mountR2Bucket(sandbox, opts, log);
    await hydrateWorkingTree(sandbox, log);
    log("sandbox.ready", {
      durationMs: Math.round(performance.now() - startedAt),
    });
    return sandbox;
  })();

  // Nothing awaits this until the first tool call, which may never come. A
  // rejection with no handler attached would take the process down under
  // Node's default unhandled-rejection policy; this marks it handled while
  // leaving `promise` itself rejected for whoever does await it.
  void promise.catch(() => undefined);

  return promise;
}
