import type { FileUIPart } from "ai";

/** What the upload route returns for one stored file. */
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

/**
 * POST one file to `/api/upload`, into the given thread's uploads/ folder.
 *
 * Same-origin multipart, so the browser never talks to R2 directly and no
 * bucket CORS is needed. The route derives userId from Clerk, so only threadId
 * and the file travel from here.
 */
export async function uploadFile(
  threadId: string,
  file: File,
): Promise<UploadedFile> {
  const form = new FormData();
  form.append("threadId", threadId);
  form.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `upload failed (${res.status})`);
  }
  return (await res.json()) as UploadedFile;
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
