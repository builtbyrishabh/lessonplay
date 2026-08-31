import type { FileUIPart } from "ai";

/** What the upload flow yields for one stored file. */
export type UploadedFile = {
  /**
   * The URL the model reads the file from. It lives in Memory for the life of
   * the thread and is fetched again on every turn, so it never expires (see
   * `uploadReadUrl` in `~/server/r2`).
   */
  url: string;
  /** Name as it lands in uploads/ — random prefix plus the sanitized original. */
  filename: string;
  size: number;
  mediaType: string;
};

/** What `/api/upload` returns: a signed PUT plus the eventual read URL. */
type SignedUpload = UploadedFile & { uploadUrl: string };

/**
 * Upload one file into the given thread's uploads/ folder.
 *
 * Two steps, no bytes through the app server:
 *   1. POST metadata to `/api/upload` — it validates and returns a presigned
 *      PUT URL (scoped to the caller's own prefix via Clerk).
 *   2. PUT the file straight to R2. The `Content-Type` MUST equal the one the
 *      server signed, or R2 rejects the signature.
 *
 * Keeping the bytes off the function dodges the serverless request-body limit
 * (which is what made big PDFs fail) and removes a hop.
 */
export async function uploadFile(
  threadId: string,
  file: File,
): Promise<UploadedFile> {
  const contentType = file.type || "application/octet-stream";

  const signRes = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      threadId,
      filename: file.name,
      contentType,
      size: file.size,
    }),
  });
  if (!signRes.ok) {
    const detail = await signRes.text().catch(() => "");
    throw new Error(detail || `upload failed (${signRes.status})`);
  }
  const signed = (await signRes.json()) as SignedUpload;

  const putRes = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": signed.mediaType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`upload failed (${putRes.status})`);
  }

  return {
    url: signed.url,
    filename: signed.filename,
    size: signed.size,
    mediaType: signed.mediaType,
  };
}

/** Upload several files, preserving order. Rejects if any one fails. */
export async function uploadFiles(
  threadId: string,
  files: File[],
): Promise<UploadedFile[]> {
  return Promise.all(files.map((file) => uploadFile(threadId, file)));
}

/**
 * Turn uploaded files into AI SDK file parts — the shape `sendMessage({ files })`
 * expects. The chat route hands the message to Mastra untouched, and the AI
 * Gateway fetches each `url` for the model.
 */
export function toFileParts(files: UploadedFile[]): FileUIPart[] {
  return files.map((f) => ({
    type: "file",
    mediaType: f.mediaType,
    filename: f.filename,
    url: f.url,
  }));
}
