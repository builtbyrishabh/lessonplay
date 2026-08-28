import type { FileUIPart } from "ai";

/**
 * Hand-off from the home page to a freshly created chat: the home page creates
 * the thread, stashes the first prompt (text plus any uploaded file parts) here,
 * navigates, and the chat page sends it once on mount. sessionStorage survives
 * the navigation but not a new tab.
 */
const KEY = (threadId: string) => `lessonplay:pending-prompt:${threadId}`;

export type PendingPrompt = {
  text: string;
  /** Files already uploaded to R2, as file parts the model can read. */
  files: FileUIPart[];
};

export function setPendingPrompt(threadId: string, prompt: PendingPrompt) {
  sessionStorage.setItem(KEY(threadId), JSON.stringify(prompt));
}

export function takePendingPrompt(threadId: string): PendingPrompt | null {
  const raw = sessionStorage.getItem(KEY(threadId));
  if (raw === null) return null;
  sessionStorage.removeItem(KEY(threadId));
  try {
    const parsed = JSON.parse(raw) as PendingPrompt;
    return { text: parsed.text ?? "", files: parsed.files ?? [] };
  } catch {
    // Older shape (a bare string) or corrupt value — treat as text only.
    return { text: raw, files: [] };
  }
}
