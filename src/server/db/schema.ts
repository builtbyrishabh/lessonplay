import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * App tables are prefixed `lessonplay_`. Mastra Memory (threads/messages) owns
 * its own tables via @mastra/pg and is not modelled here.
 */
export const createTable = pgTableCreator((name) => `lessonplay_${name}`);

/**
 * One row per successful `publish`.
 *
 * An INDEX over R2, not a copy of it. The bytes live in the bucket — the source
 * snapshot as `versions/<n>.tar.gz`, the built game as `versions/<n>.html` and
 * (for the newest) `current/index.html`. Version numbers are still allocated by
 * `publishScript()` from the bucket listing, so R2 stays the single source of
 * truth and a publish still works with the database down.
 *
 * What this buys: the app can answer "does this thread have a game, which
 * version, published when" on page load without booting the sandbox or holding
 * an S3 client. That is what the preview pane and the version list need.
 *
 * Deliberately NOT storing the HTML itself. A vite-singlefile bundle inlines
 * React and every asset — a few hundred KB to a couple of MB per publish — so a
 * chatty thread would put tens of MB of TOASTed text in Postgres duplicating
 * bytes R2 already serves over a CDN.
 */
export const gameVersions = createTable(
  "game_version",
  {
    /** Mastra Memory thread id. Not a FK: those tables belong to @mastra/pg. */
    threadId: text("thread_id").notNull(),
    /** Clerk user id. Every query filters on it — ownership is checked here. */
    userId: text("user_id").notNull(),
    /** Allocated by the bucket, starting at 1. */
    version: integer("version").notNull(),
    /**
     * The publish tool's `intent`, written by the model for the teacher
     * ("Publishing the titration lab"). A human label for the version list;
     * nothing keys off it.
     */
    label: text("label"),
    /** `games/<userId>/<threadId>/versions/<n>.tar.gz` — the source snapshot. */
    snapshotKey: text("snapshot_key").notNull(),
    /** `games/<userId>/<threadId>/versions/<n>.html` — this version's build. */
    htmlKey: text("html_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (t) => [
    // The natural key. Also the uniqueness constraint that makes recording a
    // publish idempotent: a retry upserts rather than duplicating a version.
    primaryKey({ columns: [t.threadId, t.version] }),
    // Serves the two reads there are: newest version for a thread, and the
    // thread's version list newest-first.
    index("game_version_thread_created_idx").on(t.threadId, t.createdAt),
  ],
);

export type GameVersion = typeof gameVersions.$inferSelect;
