import type { FileUIPart } from "ai";
import { atom, getDefaultStore } from "jotai";

/**
 * Hand-off from the home page to a freshly created chat.
 *
 * The home page now uploads attachments the moment they're picked (see
 * `PromptBox`), so by the time the teacher hits send the files are already in
 * R2 and this handoff carries **ready** file parts — the chat page dispatches
 * the first message immediately, with no upload on the critical path.
 *
 * It lives in a jotai atom rather than sessionStorage for one reason: the value
 * has to outlive the component that created it. The home page unmounts on
 * navigation and a different mounted component (the chat page) reads it after,
 * so a `useState` cannot bridge them; jotai's default store is a browser-wide
 * singleton that survives the client navigation (but not a hard refresh — an
 * accepted trade: on refresh the teacher re-attaches).
 */
export type PendingPrompt = {
  text: string;
  /** Uploaded before send, so the chat page can dispatch without awaiting. */
  files: FileUIPart[];
};

const pendingPromptAtom = atom<Record<string, PendingPrompt | undefined>>({});
const store = getDefaultStore();

export function setPendingPrompt(threadId: string, prompt: PendingPrompt) {
  store.set(pendingPromptAtom, (prev) => ({ ...prev, [threadId]: prompt }));
}

/** Read once and clear — a handoff is consumed exactly one time. */
export function takePendingPrompt(threadId: string): PendingPrompt | null {
  const prompt = store.get(pendingPromptAtom)[threadId];
  if (!prompt) return null;
  store.set(pendingPromptAtom, (prev) => {
    const next = { ...prev };
    delete next[threadId];
    return next;
  });
  return prompt;
}
