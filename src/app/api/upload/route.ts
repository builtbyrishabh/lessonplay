import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";

import { sanitizeUploadFilename, uploadObjectKey } from "~/lib/sandbox-paths";
import { isValidThreadId } from "~/lib/thread-id";
import { putObject, uploadReadUrl } from "~/server/r2";

export const maxDuration = 300;

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
 * Upload one file into games/<userId>/<threadId>/uploads/.
 *
 * The only app-side write into R2 (see `~/server/r2`). threadId is
 * client-generated, so it is validated for shape but NOT for existence: a file
 * may legitimately arrive before the thread's first prompt has created it. The
 * userId comes from Clerk, never the body, so the write is always scoped to the
 * caller's own prefix.
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("expected multipart/form-data", { status: 400 });
  }

  const threadId = form.get("threadId");
  const file = form.get("file");

  if (typeof threadId !== "string" || !isValidThreadId(threadId)) {
    return new Response("threadId is invalid", { status: 400 });
  }
  if (!(file instanceof File)) {
    return new Response("a file is required", { status: 400 });
  }
  if (file.size === 0) {
    return new Response("file is empty", { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return new Response("file is too large (max 20 MB)", { status: 413 });
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) {
    return new Response(`unsupported file type: ${contentType}`, {
      status: 415,
    });
  }

  // Random prefix: the bucket is public by key, and a game's share link already
  // reveals games/<userId>/<threadId>/, so a bare "chapter.pdf" would be
  // guessable from it. The agent sees this same name at ~/r2/uploads/.
  const filename = `${nanoid(8)}-${sanitizeUploadFilename(file.name)}`;
  const key = uploadObjectKey(userId, threadId, filename);
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    await putObject(key, bytes, contentType);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "upload failed", {
      status: 502,
    });
  }

  return Response.json({
    url: await uploadReadUrl(key),
    filename,
    size: file.size,
    mediaType: contentType,
  });
}
