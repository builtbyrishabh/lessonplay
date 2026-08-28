"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import type { FileUIPart } from "ai";

import { deriveGameFiles, type GameFilesState } from "~/lib/game-files";
import { useSettings } from "~/lib/hooks/use-settings";
import { takePendingPrompt } from "~/lib/pending-prompt";
import { toFileParts, uploadFiles } from "~/lib/upload";
import { api } from "~/trpc/react";

/**
 * Owns the chat stream for a thread.
 *
 * `useChat` used to live inside the conversation column, which meant the
 * workspace pane beside it could not see a thing. Both panes now read the same
 * stream from here: the conversation renders the messages, and the code view
 * reads the *partially streamed* `write` tool inputs out of those same
 * messages, which is what lets the teacher watch a file being typed.
 */

type ChatContextValue = {
  threadId: string;
  messages: UIMessage[];
  status: ReturnType<typeof useChat>["status"];
  error: ReturnType<typeof useChat>["error"];
  stop: () => void;
  send: (text: string, files?: File[]) => void;
  /** Files the agent has authored, folded out of the tool calls. */
  gameFiles: GameFilesState;
  /** Id of the assistant message currently streaming, if any. */
  streamingMessageId: string | null;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used inside <ChatProvider>");
  }
  return context;
}

export function ChatProvider({
  threadId,
  initialMessages,
  children,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  children: ReactNode;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const { settings } = useSettings();
  const hadTitleRef = useRef(initialMessages.length > 0);
  const sentPendingRef = useRef(false);
  // Read through a ref so `send` does not change identity when the model does.
  const modelRef = useRef(settings.model);
  modelRef.current = settings.model;

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // Memory is the source of truth: send only the newest user message.
      prepareSendMessagesRequest: ({ messages, id, body }) => ({
        body: { message: messages.at(-1), threadId: id, ...body },
      }),
    }),
    onFinish: () => {
      // First reply on a thread → the auto-title exists now; refresh the sidebar.
      if (!hadTitleRef.current) {
        hadTitleRef.current = true;
        void utils.chats.list.invalidate();
        router.refresh();
      }
      // A publish may have happened in that turn. Cheap to ask; the preview
      // pane swaps to the new version the moment the row exists.
      void utils.games.latest.invalidate({ threadId });
      void utils.games.list.invalidate({ threadId });
    },
  });

  // The one place a user message goes on the wire. Attachments ride as file
  // parts carrying the uploaded file's URL; the route passes them to the agent
  // untouched and the AI Gateway fetches them for the model.
  const dispatch = useCallback(
    (text: string, files: FileUIPart[]) => {
      void sendMessage({ text, files }, { body: { model: modelRef.current } });
    },
    [sendMessage],
  );

  // Stable identity: the context value is memoised, and a `send` that changed
  // every render would re-render both panes on every streamed token.
  const send = useCallback(
    (text: string, files: File[] = []) => {
      void (async () => {
        // Land attachments in R2 first (they also surface at ~/r2/uploads/ in
        // the sandbox). If the upload fails, don't send a message that points
        // at files the model can't fetch.
        let parts: FileUIPart[] = [];
        if (files.length > 0) {
          try {
            parts = toFileParts(await uploadFiles(threadId, files));
          } catch (err) {
            console.error("[lesson-chat] upload failed", err);
            return;
          }
        }
        dispatch(text, parts);
      })();
    },
    [dispatch, threadId],
  );

  // First prompt handed off from the home page — its files are already
  // uploaded, so dispatch them straight through without re-uploading.
  useEffect(() => {
    if (sentPendingRef.current) return;
    sentPendingRef.current = true;
    const pending = takePendingPrompt(threadId);
    if (pending) dispatch(pending.text, pending.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const gameFiles = useMemo(() => deriveGameFiles(messages), [messages]);

  const streamingMessageId = useMemo(() => {
    if (status !== "streaming") return null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message?.role === "assistant") return message.id;
    }
    return null;
  }, [messages, status]);

  const value = useMemo<ChatContextValue>(
    () => ({
      threadId,
      messages,
      status,
      error,
      stop,
      send,
      gameFiles,
      streamingMessageId,
    }),
    [
      threadId,
      messages,
      status,
      error,
      stop,
      send,
      gameFiles,
      streamingMessageId,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
