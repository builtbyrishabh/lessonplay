import type { FileUIPart } from "ai";

/**
 * The first prompt, handed from the home surface to the conversation — Branch B.
 *
 * The submit handler (`startChat`) and the conversation both live under the same
 * always-mounted `ChatsHarness`, so the handoff needs nothing that outlives a
 * component: it is just a piece of that component's state (`committedSeed`).
 * `startChat` sets it synchronously — in the same event, before it flips `?id=`
 * — so the seed is already present on the first render that shows the
 * conversation. No module store, no effect, no in-between frame to cover.
 *
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
