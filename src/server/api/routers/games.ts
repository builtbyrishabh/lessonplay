import { z } from "zod";

import { isValidThreadId } from "~/lib/thread-id";
import { latestGameVersion, listGameVersions } from "~/server/db/games";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
// Null when R2_PUBLIC_BASE_URL is unset: the preview pane then shows "not
// configured" rather than an iframe pointed at a broken origin.
import { publicObjectUrl } from "~/server/r2";

const threadIdSchema = z.string().refine(isValidThreadId, "invalid threadId");

/**
 * The published game, for the preview pane.
 *
 * Reads the index rather than the bucket — the whole reason
 * `lessonplay_game_version` exists is so a page load can answer "is there a
 * game here" without booting this thread's sandbox or listing R2.
 */
export const gamesRouter = createTRPCRouter({
  /** Newest version, or null for a thread that has never published. */
  latest: protectedProcedure
    .input(z.object({ threadId: threadIdSchema }))
    .query(async ({ ctx, input }) => {
      const row = await latestGameVersion(input.threadId, ctx.userId);
      if (!row) return null;
      return {
        version: row.version,
        label: row.label,
        createdAt: row.createdAt,
        // The VERSIONED key, not current/index.html. Two reasons: this URL is
        // immutable, so the CDN can cache it forever and no cache-buster is
        // needed; and the pane can show any version, not only the newest.
        // current/ stays the stable target a teacher shares — see `sharePath`.
        url: publicObjectUrl(row.htmlKey),
        // A same-origin path, NOT the bucket URL: the raw key embeds the
        // Clerk user id, and a share link travels to whole classrooms. The
        // /play route proxies current/index.html and keeps the id server-side.
        // A path (not an absolute URL) so localhost and preview deploys hand
        // out links on their own origin.
        sharePath: `/play/${input.threadId}`,
      };
    }),

  /** Every version, newest first — the version picker in the preview header. */
  list: protectedProcedure
    .input(z.object({ threadId: threadIdSchema }))
    .query(async ({ ctx, input }) => {
      const rows = await listGameVersions(input.threadId, ctx.userId);
      return rows.map((row) => ({
        version: row.version,
        label: row.label,
        createdAt: row.createdAt,
        url: publicObjectUrl(row.htmlKey),
      }));
    }),
});
