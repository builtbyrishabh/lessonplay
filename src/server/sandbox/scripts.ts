/**
 * The shell scripts that move a game across the durability boundary.
 *
 * They live here, apart from the tool and the prepare step that run them, for
 * two reasons: this module imports no env, so unit tests can read the scripts
 * without Daytona; and `scripts/sandbox-smoke.ts` runs these exact strings
 * against a real R2 mount rather than a copy that can drift.
 */
import {
  ENGINE_ROOT,
  GAME_ROOT,
  PUBLISHED_FILE,
  R2_CURRENT_DIR,
  R2_VERSIONS_DIR,
} from "~/lib/sandbox-paths";

/**
 * Run the engine's build-time gate over the game in the working tree.
 *
 * The gate itself lives in `@learn-loop/core` (`bin/validate.ts`) and is invoked
 * by absolute path out of the engine, never out of GAME_ROOT: the agent owns
 * every file in the working tree, so a gate it could rewrite would not be a gate
 * at all. tsx comes from the engine's own devDependencies, already installed in
 * the snapshot.
 *
 * Exit codes come straight from the CLI — 0 pass, 1 the game has errors, 2 the
 * game could not be located — and both callers depend on telling those apart.
 */
export function validateScript(): string {
  return [
    `${ENGINE_ROOT}/node_modules/.bin/tsx`,
    `${ENGINE_ROOT}/packages/learn-loop-core/bin/validate.ts`,
    GAME_ROOT,
  ].join(" ");
}

/**
 * Restore the newest published snapshot into an empty working tree.
 *
 * Two no-ops to be careful about: a resumed sandbox already holds the live
 * tree, which may be *ahead* of the last publish, so a non-empty GAME_ROOT is
 * left strictly alone; and a thread that has never published has nothing to
 * restore. Both exit 0 — this must never be the reason a request fails.
 */
export function hydrateScript(): string {
  return [
    "set -e",
    `mkdir -p ${GAME_ROOT}`,
    `if [ -n "$(find ${GAME_ROOT} -mindepth 1 -maxdepth 1 -print -quit)" ]; then echo RESUMED; exit 0; fi`,
    `latest=$(ls -1 ${R2_VERSIONS_DIR} 2>/dev/null | sed -n 's/^\\([0-9][0-9]*\\)\\.tar\\.gz$/\\1/p' | sort -n | tail -1)`,
    `if [ -z "$latest" ]; then echo FRESH; exit 0; fi`,
    // Copy the object out of the mount first, then unpack on local disk: one
    // GET instead of a read per file through FUSE.
    `cp ${R2_VERSIONS_DIR}/"$latest".tar.gz /tmp/restore.tar.gz`,
    `tar -xzf /tmp/restore.tar.gz -C ${GAME_ROOT}`,
    "rm -f /tmp/restore.tar.gz",
    `echo "HYDRATED $latest"`,
  ].join("\n");
}

/**
 * Point the working tree at the engine's already-installed dependencies.
 *
 * The game templates are npm workspace members, so their deps are hoisted to
 * ~/engine/node_modules and a plain `cp` of a template lands a project with no
 * node_modules at all — `npm test` then dies with "vitest: not found". A
 * symlink fixes that in milliseconds instead of a 30s+ install.
 *
 * Writing through the link would land packages in ~/engine, which is normally
 * a thing to avoid; here it is harmless, because every thread gets its own
 * sandbox and therefore its own private copy of the engine. Runs after
 * hydrate, never before: an early symlink would make GAME_ROOT look non-empty
 * and turn the restore into a no-op.
 */
export function linkEngineModulesScript(): string {
  return [
    `mkdir -p ${GAME_ROOT}`,
    // Only when nothing is there — a real node_modules means the agent ran its
    // own install, and that must win.
    `if [ -e ${GAME_ROOT}/node_modules ]; then echo EXISTS; exit 0; fi`,
    `ln -s ${ENGINE_ROOT}/node_modules ${GAME_ROOT}/node_modules`,
    "echo LINKED",
  ].join("\n");
}

/**
 * Everything that has to happen inside the mount, as one script.
 *
 * Order is the whole design. The version snapshot is written first and the
 * single published file last, so a transfer that dies partway leaves the
 * previous game still serving. That last `cp` is one object write, which S3
 * makes atomic: a reader gets the old file or the new one, never a splice.
 */
export function publishScript(): string {
  return [
    "set -e",
    `test -f ${GAME_ROOT}/dist/${PUBLISHED_FILE} || { echo NO_BUILD; exit 3; }`,
    // A self-contained bundle is what makes the publish a single atomic write.
    // Anything else in dist/ means assets the preview URL could never resolve.
    `extra=$(find ${GAME_ROOT}/dist -mindepth 1 ! -name ${PUBLISHED_FILE} | head -5)`,
    `if [ -n "$extra" ]; then echo NOT_SELF_CONTAINED; echo "$extra"; exit 4; fi`,
    `mkdir -p ${R2_VERSIONS_DIR} ${R2_CURRENT_DIR}`,
    // Version numbers come from the bucket, not a database, so R2 stays the
    // single source of truth and publish works with no app state at all.
    `prev=$(ls -1 ${R2_VERSIONS_DIR} 2>/dev/null | sed -n 's/^\\([0-9][0-9]*\\)\\.tar\\.gz$/\\1/p' | sort -n | tail -1)`,
    `if [ -z "$prev" ]; then prev=0; fi`,
    "next=$(( prev + 1 ))",
    // A whole version is ONE object. Writing the tree out file by file meant a
    // PUT per file through FUSE, which measured at ~40s for a small template;
    // packing first turns the whole snapshot into a single write. It also
    // makes a version indivisible: it either exists complete or not at all.
    `tar -czf /tmp/snapshot.tar.gz --exclude=./node_modules --exclude=./dist --exclude=./.git -C ${GAME_ROOT} .`,
    `cp /tmp/snapshot.tar.gz ${R2_VERSIONS_DIR}/"$next".tar.gz`,
    "rm -f /tmp/snapshot.tar.gz",
    `cp ${GAME_ROOT}/dist/${PUBLISHED_FILE} ${R2_CURRENT_DIR}/${PUBLISHED_FILE}`,
    'echo "PUBLISHED $next"',
  ].join("\n");
}
