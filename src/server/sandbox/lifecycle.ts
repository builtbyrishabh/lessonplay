/**
 * Pure sandbox-lifecycle logic — no `~/env`, no SDK client — so it can be
 * imported by `~/mastra/tools/*` and unit-tested without Daytona.
 *
 * Why this exists: Daytona has ~23 sandbox states, and the old lifecycle walk
 * in `daytona.ts` handled four of them. A thread reopened while its sandbox
 * was mid-archive (state "archiving") got a handle with no running container,
 * and every tool call failed with "failed to resolve container IP … Is the
 * Sandbox started?". Every state now maps to an explicit step, and unknown
 * states are waited on rather than silently used.
 */
import { SandboxState, type Sandbox } from "@daytonaio/sdk";

/** What to do next for a sandbox observed in `state`. */
export type SandboxStep =
  /** Running — use it. */
  | "use"
  /** At rest but startable (stopped / archived / paused) — call start(). */
  | "start"
  /** Already on its way up — wait for started. */
  | "wait-started"
  /** Mid-transition (stopping, archiving, …) — poll until it settles. */
  | "wait"
  /** Terminal or broken — starting it is impossible; surface a clear error. */
  | "fail";

export function planSandboxStep(state: Sandbox["state"]): SandboxStep {
  switch (state) {
    case SandboxState.STARTED:
      return "use";
    case SandboxState.STOPPED:
    case SandboxState.ARCHIVED:
    case SandboxState.PAUSED:
      return "start";
    case SandboxState.STARTING:
    case SandboxState.RESUMING:
    case SandboxState.RESTORING:
    case SandboxState.CREATING:
    case SandboxState.PULLING_SNAPSHOT:
      return "wait-started";
    case SandboxState.ERROR:
    case SandboxState.BUILD_FAILED:
    case SandboxState.DESTROYED:
    case SandboxState.DESTROYING:
      return "fail";
    // stopping, archiving, pausing, snapshotting, resizing, forking, unknown,
    // and anything a future SDK adds: in motion (or unreadable) — poll until
    // it lands somewhere actionable. The caller owns the deadline.
    default:
      return "wait";
  }
}

/**
 * Does this error mean "the container under this sandbox handle is gone"?
 *
 * That is the signature of the sandbox being stopped/archived between our
 * state check and the command — the exact failure seen in production as
 * "bad request: failed to resolve container IP after 3 attempts: no IP
 * address found. Is the Sandbox started?".
 */
export function isSandboxUnreachableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /failed to resolve container ip|is the sandbox started\?|sandbox is not (?:started|running)/i.test(
    message,
  );
}

/**
 * Run `fn` against the sandbox, recovering ONCE if the container turns out to
 * be gone — either the promise itself rejected that way (boot raced an
 * archive) or a call inside `fn` did (auto-stop raced a long request).
 *
 * `recover` is expected to re-run the full preparation (start + R2 mount +
 * hydrate) — a bare restart is not enough, because the s3fs mount does not
 * survive the container. `prepareLessonSandbox` is idempotent and is the
 * intended recover function. `fn` must therefore be safe to re-run from the
 * top, which every tool body is: nothing in it completed if the container was
 * unreachable.
 */
export async function withRecoveredSandbox<T>(
  sandboxPromise: Promise<Sandbox>,
  recover: (() => Promise<Sandbox>) | undefined,
  fn: (sandbox: Sandbox) => Promise<T>,
): Promise<T> {
  let sandbox: Sandbox;
  try {
    sandbox = await sandboxPromise;
  } catch (err) {
    if (!recover || !isSandboxUnreachableError(err)) throw err;
    return fn(await recover());
  }
  try {
    return await fn(sandbox);
  } catch (err) {
    if (!recover || !isSandboxUnreachableError(err)) throw err;
    return fn(await recover());
  }
}
