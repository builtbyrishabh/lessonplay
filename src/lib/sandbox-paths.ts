/** Paths inside the Daytona sandbox. Everything is per-thread. */
export const SANDBOX_HOME = "/home/daytona";

/**
 * The working tree — plain local disk, NOT object storage. npm installs,
 * builds and test runs happen here, so it has to be a real filesystem: s3fs
 * turns every file close into a PUT and every rename into a copy+delete,
 * which is exactly what a build does thousands of times.
 *
 * Consequence: nothing here survives the sandbox being reclaimed. Durability
 * comes from `publish`, which copies into R2_ROOT.
 */
export const GAME_ROOT = `${SANDBOX_HOME}/game`;

/** R2 FUSE mount → games/<userId>/<threadId>/. The durability boundary. */
export const R2_ROOT = `${SANDBOX_HOME}/r2`;
/** The single published HTML file the teacher's preview URL serves. */
export const R2_CURRENT_DIR = `${R2_ROOT}/current`;
/** Append-only source snapshots, one numbered directory per publish. */
export const R2_VERSIONS_DIR = `${R2_ROOT}/versions`;
/**
 * Teacher-supplied source material (a chapter PDF, an activity sheet). Written
 * by the app's upload route straight into R2, so it shows up here the moment
 * the sandbox mounts — the agent reads it, nothing writes it from inside.
 */
export const R2_UPLOADS_DIR = `${R2_ROOT}/uploads`;

/**
 * The engine monorepo: @learn-loop/core, the game templates, and the 102
 * hoisted packages. Not a staging area — GAME_ROOT/node_modules symlinks into
 * this one, so it is the dependency root for every build.
 *
 * Skills are NOT here. They are served from the app; see `~/mastra/skills`.
 */
export const ENGINE_ROOT = `${SANDBOX_HOME}/engine`;

/**
 * The starter every game is a modification of. Copied into GAME_ROOT once, by
 * `scaffoldTemplateScript()`, the first time a thread's working tree is empty —
 * so the model edits a project that already builds instead of assembling one.
 */
export const GAME_TEMPLATE_ROOT = `${ENGINE_ROOT}/games/chemistry-lab-bench`;

/** The one file `publish` writes; the preview URL points straight at it. */
export const PUBLISHED_FILE = "index.html";

export function sandboxIdForThread(threadId: string) {
  return `lessonplay-${threadId}`;
}

/** Bucket prefix that R2_ROOT is mounted onto. */
export function gameBucketPrefix(userId: string, threadId: string) {
  return `games/${userId}/${threadId}`;
}

/** Object key of the published game. Computed here, never by the model. */
export function publishedGameKey(userId: string, threadId: string) {
  return `${gameBucketPrefix(userId, threadId)}/current/${PUBLISHED_FILE}`;
}

/**
 * Object key of ONE version's source snapshot.
 *
 * Mirrors the name `publishScript()` writes. Both spellings have to agree, so
 * the script builds the path from R2_VERSIONS_DIR and this rebuilds the same
 * name as a bucket key; the smoke test covers the script side.
 */
export function versionSnapshotKey(
  userId: string,
  threadId: string,
  version: number,
) {
  return `${gameBucketPrefix(userId, threadId)}/versions/${version}.tar.gz`;
}

/**
 * Object key of ONE version's built game.
 *
 * `current/index.html` is overwritten on every publish, so without this an
 * older version could only be previewed by rebuilding its tarball. Written
 * alongside the snapshot by `publishScript()`.
 */
export function versionHtmlKey(
  userId: string,
  threadId: string,
  version: number,
) {
  return `${gameBucketPrefix(userId, threadId)}/versions/${version}.html`;
}

/**
 * Collapse a client-supplied filename to a single safe basename.
 *
 * The upload key is built from this and nothing else, so it is the only thing
 * standing between a browser and writing to `../current/index.html`. Strips any
 * directory part, keeps a conservative charset, and never returns "" — an empty
 * or all-junk name becomes a timestamp-free "file" the caller can prefix.
 */
export function sanitizeUploadFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 128);
  return cleaned || "file";
}

/** Bucket prefix uploads live under: games/<userId>/<threadId>/uploads. */
export function uploadsPrefix(userId: string, threadId: string) {
  return `${gameBucketPrefix(userId, threadId)}/uploads`;
}

/**
 * Object key of one uploaded file. `name` MUST already be sanitized — callers
 * pass it through `sanitizeUploadFilename` first — so the key can never escape
 * the thread's uploads/ folder.
 */
export function uploadObjectKey(
  userId: string,
  threadId: string,
  name: string,
) {
  return `${uploadsPrefix(userId, threadId)}/${name}`;
}

/**
 * Turn whatever path the model produced into an absolute sandbox path.
 *   "~/engine/x"       → /home/daytona/engine/x
 *   "/home/daytona/x"  → unchanged
 *   "src/scenario.ts"  → /home/daytona/game/src/scenario.ts
 *
 * Relative paths resolve against GAME_ROOT because that is where the model
 * spends almost all of its time; anything else it can spell out.
 */
export function expandSandboxPath(input: string): string {
  const raw = input.trim();
  const absolute = raw.startsWith("~/")
    ? `${SANDBOX_HOME}/${raw.slice(2)}`
    : raw === "~"
      ? SANDBOX_HOME
      : raw.startsWith("/")
        ? raw
        : `${GAME_ROOT}/${raw}`;

  // posix-normalize by hand: this must behave identically on a Windows dev box,
  // where node:path would hand back backslashes.
  const parts: string[] = [];
  for (const segment of absolute.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return `/${parts.join("/")}`;
}
