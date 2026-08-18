/** Thread ids are client-generated; keep them URL/DB safe. */
const THREAD_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidThreadId(value: unknown): value is string {
  return typeof value === "string" && THREAD_ID_RE.test(value);
}

export function newThreadId() {
  return crypto.randomUUID();
}
