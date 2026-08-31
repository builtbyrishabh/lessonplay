import {
  Daytona,
  DaytonaNotFoundError,
  SandboxState,
  type Sandbox,
} from "@daytonaio/sdk";

import { env } from "~/env";
import { planSandboxStep } from "./lifecycle";

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
  /** Found mid-transition (archiving, stopping, …) and walked to started. */
  | "existing-recovered";

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

/** Generous: restoring an archived ~3 GiB filesystem is minutes, not seconds. */
const START_TIMEOUT_SECONDS = 120;
/** How long a sandbox may sit in a transitional state before we give up. */
const SETTLE_TIMEOUT_MS = 180_000;
const SETTLE_POLL_MS = 2_000;
/** start() attempts before concluding the sandbox will not come up. */
const MAX_START_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Walk the sandbox to STARTED, whatever state it is observed in.
 *
 * The old version handled exactly four states and silently returned the
 * sandbox for every other one — so a thread reopened while Daytona was
 * archiving it ("archiving" takes minutes for a 3 GiB disk) got a handle with
 * no running container, and every tool call died with "failed to resolve
 * container IP". Now: startable states are started, in-flight states are
 * waited out (with a deadline), and broken states throw something readable
 * instead of a container-IP error five calls later.
 */
async function ensureSandboxStarted(sandbox: Sandbox): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let startAttempts = 0;

  for (;;) {
    const state = sandbox.state;
    const step = planSandboxStep(state);

    if (step === "use") return;

    if (step === "fail") {
      throw new Error(
        `[LessonPlay] sandbox ${sandbox.id} is "${String(state)}" and cannot be started. ` +
          `It needs to be deleted (or recreated) in Daytona before this thread can build again.`,
      );
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `[LessonPlay] sandbox ${sandbox.id} did not reach "started" within ${Math.round(
          SETTLE_TIMEOUT_MS / 1000,
        )}s (still "${String(state)}"). Try again in a minute.`,
      );
    }

    if (step === "start") {
      if (++startAttempts > MAX_START_ATTEMPTS) {
        throw new Error(
          `[LessonPlay] sandbox ${sandbox.id} fell back to "${String(state)}" after ${MAX_START_ATTEMPTS} start attempts.`,
        );
      }
      await sandbox.start(START_TIMEOUT_SECONDS);
    } else if (step === "wait-started") {
      await sandbox.waitUntilStarted(START_TIMEOUT_SECONDS);
    } else {
      // "wait": mid-transition (stopping, archiving, …). Poll until it lands
      // in a state we can act on.
      await sleep(SETTLE_POLL_MS);
    }

    await sandbox.refreshData();
  }
}

/** The status the old four-state walk would have reported, for log continuity. */
function statusForInitialState(
  state: Sandbox["state"],
): SandboxLifecycleStatus {
  if (state === SandboxState.STARTED) return "existing-started";
  if (
    state === SandboxState.STOPPED ||
    state === SandboxState.ARCHIVED ||
    state === SandboxState.PAUSED
  ) {
    return "existing-started-from-stopped";
  }
  if (state === SandboxState.STARTING) return "existing-waited-from-starting";
  return "existing-recovered";
}

/**
 * Resolve the sandbox for a stable name, walking its lifecycle:
 *   missing → create
 *   STARTED → use
 *   STOPPED / ARCHIVED / PAUSED → start, then use
 *   STARTING (and other states already on the way up) → wait, then use
 *   mid-transition (STOPPING / ARCHIVING / …) → wait until settled, then start
 *   ERROR / DESTROYED → throw a readable error
 * Idempotent: safe to call on every request.
 */
export async function getOrCreateSandbox(
  sandboxId: string,
  opts: { env?: Record<string, string> },
): Promise<{
  sandbox: Sandbox;
  status: SandboxLifecycleStatus;
  /** Raw state the sandbox was first observed in; undefined when created. */
  initialState?: string;
}> {
  const daytona = getDaytonaClient();

  try {
    const sandbox = await daytona.get(sandboxId);
    const initialState = sandbox.state;
    await ensureSandboxStarted(sandbox);
    return {
      sandbox,
      status: statusForInitialState(initialState),
      initialState: String(initialState),
    };
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
    // autoDelete) and needs no new code path: getOrCreateSandbox walks an
    // ARCHIVED (or mid-ARCHIVING) sandbox back to started. Cost is a slower
    // restore on a cold thread.
    autoArchiveInterval: 60,
    autoDeleteInterval: -1, // never auto-delete; recreating means a fresh npm ci
    envVars: opts.env,
  });
  return { sandbox, status: "created" };
}
