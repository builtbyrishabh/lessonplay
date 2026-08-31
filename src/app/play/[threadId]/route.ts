import type { NextRequest } from "next/server";

import { publishedGameKey } from "~/lib/sandbox-paths";
import { isValidThreadId } from "~/lib/thread-id";
import { latestGameVersionByThread } from "~/server/db/games";
import { publicObjectUrl } from "~/server/r2";

/**
 * The teacher's share link: `/play/<threadId>`.
 *
 * The published game physically lives at
 * `games/<userId>/<threadId>/current/index.html` in the bucket — a path that
 * bakes the owner's Clerk user id into every URL. Handing that URL out leaks
 * the id to whole classrooms, so this route is the one the app shares instead:
 * it resolves the owner from the publish index and streams the game through,
 * keeping the bucket layout (and the user id) server-side.
 *
 * Public on purpose (see `middleware.ts`): a share link is opened by students
 * who hold no session. The thread id is the only capability, same as the
 * bucket's unguessable-path model, and it serves nothing but the built game.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  if (!isValidThreadId(threadId)) return new Response(null, { status: 404 });

  const row = await latestGameVersionByThread(threadId);
  if (!row) return new Response(null, { status: 404 });

  // `current/index.html`, not the versioned key — the share link must keep
  // tracking the newest publish, exactly like the raw current/ URL did.
  const url = publicObjectUrl(publishedGameKey(row.userId, threadId));
  if (!url) return new Response(null, { status: 503 });

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return new Response(null, { status: 404 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // A class of thirty opening the link at once should hit the CDN, but a
      // republish should show up within a minute — current/ is mutable.
      "Cache-Control": "public, max-age=0, s-maxage=60",
      // Share links are for people who hold them, not search results.
      "X-Robots-Tag": "noindex",
    },
  });
}
