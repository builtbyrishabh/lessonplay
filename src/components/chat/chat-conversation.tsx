"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import { Message, MessageContent } from "~/components/ai-elements/message";
import { Shimmer } from "~/components/ai-elements/shimmer";
import { MessageParts } from "~/components/chat/message-parts";
import { PromptBox } from "~/components/prompt-box";
import { useSettings } from "~/lib/hooks/use-settings";
import { takePendingPrompt } from "~/lib/pending-prompt";
import { api } from "~/trpc/react";

export function ChatConversation({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const { settings, updateSettings } = useSettings();
  const hadTitleRef = useRef(initialMessages.length > 0);
  const sentPendingRef = useRef(false);

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
    },
  });

  const send = (text: string) =>
    sendMessage({ text }, { body: { model: settings.model } });

  // First prompt handed off from the home page.
  useEffect(() => {
    if (sentPendingRef.current) return;
    sentPendingRef.current = true;
    const pending = takePendingPrompt(threadId);
    if (pending) void send(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const isStreaming = status === "streaming";
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const streamingMessageId = isStreaming ? lastAssistant?.id : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-4 px-3 py-4 text-[13px] leading-relaxed">
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent
                className={
                  message.role === "user"
                    ? "group-[.is-user]:border-border group-[.is-user]:bg-muted group-[.is-user]:max-w-[80%] group-[.is-user]:rounded-2xl group-[.is-user]:border group-[.is-user]:px-3 group-[.is-user]:py-1.5 group-[.is-user]:text-[13px]"
                    : "w-full text-[13px] leading-relaxed"
                }
              >
                <MessageParts
                  isStreaming={streamingMessageId === message.id}
                  message={message}
                />
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" ? <Shimmer>Thinking…</Shimmer> : null}
          {error ? (
            <p className="text-destructive text-sm">
              Something went wrong. Try again.
            </p>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl shrink-0 px-3 pb-3">
        <PromptBox
          compact
          model={settings.model}
          onModelChange={(model) => updateSettings({ model })}
          onStop={stop}
          onSubmit={send}
          status={status}
        />
      </div>
    </div>
  );
}
