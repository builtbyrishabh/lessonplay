import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { versionHtmlKey, versionSnapshotKey } from "~/lib/sandbox-paths";
import { db } from "./index";
import { gameVersions } from "./schema";

/**
 * Reads and writes over `lessonplay_game_version`.
 *
 * Kept apart from the tRPC router so the publish tool's `recordVersion` hook
 * and the router share one definition of what a version row is — the keys in
 * particular, which have to match what `publishScript()` wrote.
 */

/**
 * Record a successful publish.
 *
 * Idempotent on (threadId, version): the primary key turns a retry into an
 * update rather than a duplicate. That matters because the version number comes
 * from the bucket, so a republish after a dropped row reuses the number.
 */
export async function recordGameVersion(input: {
  threadId: string;
  userId: string;
  version: number;
  label: string;
}) {
  const { threadId, userId, version } = input;
  await db
    .insert(gameVersions)
    .values({
      threadId,
      userId,
      version,
      label: input.label,
      snapshotKey: versionSnapshotKey(userId, threadId, version),
      htmlKey: versionHtmlKey(userId, threadId, version),
    })
    .onConflictDoUpdate({
      target: [gameVersions.threadId, gameVersions.version],
      set: { label: input.label },
    });
}

/**
 * The newest version of a thread's game, or null if it has never published.
 *
 * `userId` is part of the predicate rather than checked afterwards, so a thread
 * id belonging to someone else returns null instead of leaking a row.
 */
export async function latestGameVersion(threadId: string, userId: string) {
  const [row] = await db
    .select()
    .from(gameVersions)
    .where(
      and(eq(gameVersions.threadId, threadId), eq(gameVersions.userId, userId)),
    )
    .orderBy(desc(gameVersions.version))
    .limit(1);
  return row ?? null;
}

/**
 * The newest version by thread id alone — for the public /play route, where
 * there is no signed-in user to filter on. The thread id is an unguessable
 * UUID and the row is only ever used to locate the built game in the bucket,
 * so this widens what a share link serves, not what a stranger can enumerate.
 */
export async function latestGameVersionByThread(threadId: string) {
  const [row] = await db
    .select()
    .from(gameVersions)
    .where(eq(gameVersions.threadId, threadId))
    .orderBy(desc(gameVersions.version))
    .limit(1);
  return row ?? null;
}

/** Every version of a thread's game, newest first. */
export async function listGameVersions(threadId: string, userId: string) {
  return db
    .select()
    .from(gameVersions)
    .where(
      and(eq(gameVersions.threadId, threadId), eq(gameVersions.userId, userId)),
    )
    .orderBy(desc(gameVersions.version));
}
