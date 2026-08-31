import {
  Daytona,
  DaytonaNotFoundError,
  SandboxState,
  type Sandbox,
} from "@daytonaio/sdk";

import { env } from "~/env";

let client: Daytona | null = null;

/** One SDK client per process. Lazy so tests/imports don't touch env. */
export function getDaytonaClient(): Daytona {
  client ??= new Daytona({
    apiKey: env.DAYTONA_API_KEY,
    organizationId: env.DAYTONA_ORGANIZATION_ID,
  });
  return client;
}

/** How we obtained the sandbox — logged so cold vs warm starts are visible. */
export type SandboxLifecycleStatus =
  | "created"
  | "existing-started"
  | "existing-started-from-stopped"
  | "existing-waited-from-starting"
  | "existing-other";

/**
 * Daytona signals a missing sandbox with DaytonaNotFoundError; the message check
 * is a fallback in case a plain error slips through.
 */
function isNotFound(err: unknown): boolean {
  return (
    err instanceof DaytonaNotFoundError ||
    (err instanceof Error && /not found/i.test(err.message))
  );
}

/**
 * Resolve the sandbox for a stable name, walking its lifecycle:
 *   missing → create
 *   STARTED → use
 *   STOPPED / ARCHIVED → start, then use
 *   STARTING → wait, then use
 * Idempotent: safe to call on every request.
 */

export async function getOrCreateSandbox(
  sandboxId: string,
  opts: { env?: Record<string, string> },
): Promise<{ sandbox: Sandbox; status: SandboxLifecycleStatus }> {
  const daytona = getDaytonaClient();

  try {
    const sandbox = await daytona.get(sandboxId);

    if (sandbox.state === SandboxState.STARTED) {
      return { sandbox, status: "existing-started" };
    }
    if (
      sandbox.state === SandboxState.STOPPED ||
      sandbox.state === SandboxState.ARCHIVED
    ) {
      await sandbox.start();
      return { sandbox, status: "existing-started-from-stopped" };
    }
    if (sandbox.state === SandboxState.STARTING) {
      await sandbox.waitUntilStarted();
      return { sandbox, status: "existing-waited-from-starting" };
    }
    return { sandbox, status: "existing-other" };
  } catch (err) {
    // ONLY "no such sandbox" means create one. Swallowing everything here turns
    // a transient 500 or an auth failure into a create against a name that is
    // already taken.
    if (!isNotFound(err)) throw err;
  }

  // A missing snapshot would otherwise surface as an opaque create failure on
  // every new thread. One extra call, only on a thread's first ever message.
  if (env.DAYTONA_SNAPSHOT) {
    try {
      await daytona.snapshot.get(env.DAYTONA_SNAPSHOT);
    } catch (err) {
      if (!isNotFound(err)) throw err;
      throw new Error(
        `[LessonPlay] DAYTONA_SNAPSHOT is "${env.DAYTONA_SNAPSHOT}" but no such snapshot exists. ` +
          `Run \`pnpm snapshot:build ${env.DAYTONA_SNAPSHOT}\`, or unset the variable to fall back to Daytona's default image.`,
      );
    }
  }

  const sandbox = await daytona.create({
    name: sandboxId,
    // Base snapshot: ~/engine (installed) and s3fs. Identical for every
    // thread — the only per-thread thing is the R2 prefix mounted at ~/r2,
    // and that happens per request. Undefined → Daytona's default image.
    snapshot: env.DAYTONA_SNAPSHOT,
    language: "typescript",
    autoStopInterval: 30, // minutes idle → stopped (disk kept, R2 mount must be redone)
    // Minutes STOPPED before the filesystem moves to object storage and the
    // 3 GiB disk reservation is released. Was 0 — which is not "never" but the
    // platform maximum of 7 days, and a stopped sandbox holds its disk the
    // whole time. At ~3 GiB each against a 30 GiB org cap that fills in about
    // three days, so reclaim has to outrun it. Archiving is lossless (unlike
    // autoDelete) and needs no new code path: getOrCreateSandbox already
    // start()s an ARCHIVED sandbox. Cost is a slower restore on a cold thread.
    autoArchiveInterval: 60,
    autoDeleteInterval: -1, // never auto-delete; recreating means a fresh npm ci
    envVars: opts.env,
  });
  return { sandbox, status: "created" };
}
