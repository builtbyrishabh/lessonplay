import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";

import { sanitizeUploadFilename, uploadObjectKey } from "~/lib/sandbox-paths";
import { isValidThreadId } from "~/lib/thread-id";
import { presignUploadUrl, uploadReadUrl } from "~/server/r2";

/** 20 MB. A chapter PDF is well under this; big enough to be generous. */
const MAX_BYTES = 20 * 1024 * 1024;

/** Source material the agent can actually read. Kept deliberately narrow. */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * Sign one direct-to-R2 upload into games/<userId>/<threadId>/uploads/.
 *
 * The bytes no longer travel through this function — it validates the request
 * and hands back a presigned PUT the browser uploads straight to R2 with. That
 * keeps a big PDF off the function's request-body limit entirely. The userId
 * comes from Clerk, never the body, so the signed key is always scoped to the
 * caller's own prefix; threadId is client-generated and validated for shape
 * only, since a file may legitimately arrive before the thread's first prompt
 * has created it.
 *
 * Size is advisory (we never see the bytes); content-type is enforced, because
 * it is bound into the signature and the PUT must send the matching header.
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("expected a JSON body", { status: 400 });
  }

  const { threadId, filename: rawName, contentType, size } = (body ?? {}) as {
    threadId?: unknown;
    filename?: unknown;
    contentType?: unknown;
    size?: unknown;
  };

  if (typeof threadId !== "string" || !isValidThreadId(threadId)) {
    return new Response("threadId is invalid", { status: 400 });
  }
  if (typeof rawName !== "string" || rawName.length === 0) {
    return new Response("filename is required", { status: 400 });
  }
  if (typeof contentType !== "string" || !ALLOWED_TYPES.has(contentType)) {
    return new Response(`unsupported file type: ${String(contentType)}`, {
      status: 415,
    });
  }
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return new Response("file is empty", { status: 400 });
  }
  if (size > MAX_BYTES) {
    return new Response("file is too large (max 20 MB)", { status: 413 });
  }

  // Random prefix: the bucket is public by key, and a game's share link already
  // reveals games/<userId>/<threadId>/, so a bare "chapter.pdf" would be
  // guessable from it. The agent sees this same name at ~/r2/uploads/.
  const filename = `${nanoid(8)}-${sanitizeUploadFilename(rawName)}`;
  const key = uploadObjectKey(userId, threadId, filename);

  return Response.json({
    uploadUrl: await presignUploadUrl(key, contentType),
    url: await uploadReadUrl(key),
    filename,
    size,
    mediaType: contentType,
  });
}
