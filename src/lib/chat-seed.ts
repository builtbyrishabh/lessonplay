import type { FileUIPart } from "ai";
import { atom, getDefaultStore } from "jotai";

/**
 * The first prompt, handed from the home surface to the conversation — Branch B.
 *
 * Branch B never navigates: the home surface and the conversation live on the
 * same mounted `/chats` page, and starting a chat only flips the `?id=` query
 * param. There is no route change to carry a handoff across — but the submit
 * handler and the ChatProvider are still different components, and the seed has
 * to survive the `setActiveId` re-render that swaps one for the other.
 *
 * A module-level jotai atom is the smallest thing that fits: a store tied to no
 * component, holding the seed until the conversation consumes it exactly once.
 * Attachments are uploaded on attach (see `PromptBox`), so by the time a chat
 * starts the files are already in R2 and the seed carries ready file parts —
 * the conversation dispatches the first message with nothing left to await.
 */
export type ChatSeed = {
  threadId: string;
  text: string;
  /** Uploaded before send, so the conversation dispatches without awaiting. */
  files: FileUIPart[];
};

const seedAtom = atom<ChatSeed | null>(null);
const store = getDefaultStore();

export function setChatSeed(seed: ChatSeed) {
  store.set(seedAtom, seed);
}

/** Read-and-clear the seed for `threadId`, or null if none is waiting for it. */
export function takeChatSeed(threadId: string): ChatSeed | null {
  const seed = store.get(seedAtom);
  if (!seed || seed.threadId !== threadId) return null;
  store.set(seedAtom, null);
  return seed;
}
