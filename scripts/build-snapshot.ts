/**
 * Builds the base Daytona snapshot.
 *
 * Everything in it is identical for every thread — ~/engine (with node_modules)
 * and s3fs. The only per-thread difference is which R2 prefix gets mounted at
 * ~/r2, and that happens per request in r2-mount.ts. So this cost is paid once
 * here instead of on every thread's first message.
 *
 * Skills are deliberately absent: a snapshot is immutable, and skills change
 * far too often to be frozen into one. They ship with the app instead.
 *
 *   pnpm snapshot:build                 → builds "lessonplay-base"
 *   pnpm snapshot:build my-name         → builds under a different name
 *
 * Then set DAYTONA_SNAPSHOT to the printed name. Re-run (with a NEW name)
 * whenever game-engine/ changes; existing thread sandboxes keep the snapshot
 * they were born from, so delete them to pick up a new base.
 */
import "./load-env";

import { getDaytonaClient } from "../src/server/sandbox/daytona";
import { installEngine, installS3fs } from "../src/server/sandbox/init";

const SNAPSHOT_NAME = process.argv[2] ?? "lessonplay-base";
const BUILDER_NAME = "lessonplay-snapshot-builder";
/** The capture itself can take a while on a tree with node_modules in it. */
const CAPTURE_TIMEOUT_SECONDS = 900;

const t0 = performance.now();
const log = (event: string, data?: unknown) =>
  console.log(`[${Math.round(performance.now() - t0)}ms] ${event}`, data ?? "");

const daytona = getDaytonaClient();

// Idempotent: an existing snapshot is reused, never rebuilt over. That makes
// this safe to run on every deploy. A snapshot is immutable, so picking up a
// changed game-engine/ means a NEW name, not a rebuild.
try {
  const existing = await daytona.snapshot.get(SNAPSHOT_NAME);
  console.log(
    `Snapshot "${SNAPSHOT_NAME}" already exists (state: ${existing.state}) — nothing to do.\n` +
      `To pick up engine or skill changes, build a new name:\n` +
      `  pnpm snapshot:build ${SNAPSHOT_NAME}-v2`,
  );
  process.exit(0);
} catch {
  // Not found — build it.
}

// A leftover builder from a failed run would still hold the old engine.
try {
  await daytona.delete(await daytona.get(BUILDER_NAME));
  log("builder.stale_removed");
} catch {
  // Nothing to clean up.
}

log("builder.creating");
const builder = await daytona.create({
  name: BUILDER_NAME,
  language: "typescript",
  // Short leash: this sandbox exists only for the length of this script.
  autoStopInterval: 15,
  autoDeleteInterval: -1,
});
log("builder.created", { id: builder.id });

try {
  await installS3fs(builder, log);
  await installEngine(builder, log); // slowest step — uploads + npm ci

  log("snapshot.capturing", { name: SNAPSHOT_NAME });
  await builder.createSnapshot(SNAPSHOT_NAME, CAPTURE_TIMEOUT_SECONDS);
  log("snapshot.created", { name: SNAPSHOT_NAME });
} catch (err) {
  console.error(
    `\nBuild failed. The builder sandbox "${BUILDER_NAME}" was left running so you can inspect it.\n` +
      `Delete it when done — it is billable.\n`,
  );
  throw err;
}

await daytona.delete(builder);
log("builder.deleted");

console.log(
  `\nDone in ${Math.round((performance.now() - t0) / 1000)}s.\n\n` +
    `Set this in .env (and in your deployment env):\n` +
    `  DAYTONA_SNAPSHOT="${SNAPSHOT_NAME}"\n`,
);
