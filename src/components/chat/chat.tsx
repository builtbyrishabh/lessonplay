"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "~/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "~/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "~/components/ai-elements/reasoning";
import { Shimmer } from "~/components/ai-elements/shimmer";

export function Chat({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const hadTitleRef = useRef(initialMessages.length > 0);

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // Memory is the source of truth: send only the newest user message.
      prepareSendMessagesRequest: ({ messages, id }) => ({
        body: { message: messages.at(-1), threadId: id },
      }),
    }),
    onFinish: () => {
      // First reply on a thread → the auto-title exists now; refresh the sidebar.
      if (!hadTitleRef.current) {
        hadTitleRef.current = true;
        router.refresh();
      }
    },
  });

  useEffect(() => {
    if (error) console.error("[chat] stream error", error);
  }, [error]);

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="What are you teaching?"
              description="Paste a chapter section, an activity, or name a concept — we'll plan a lab that teaches it."
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case "text":
                        return (
                          <MessageResponse key={`${message.id}-${i}`}>
                            {part.text}
                          </MessageResponse>
                        );
                      case "reasoning":
                        return (
                          <Reasoning
                            key={`${message.id}-${i}`}
                            isStreaming={
                              status === "streaming" &&
                              message.id === messages.at(-1)?.id &&
                              i === message.parts.length - 1
                            }
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      default:
                        return null;
                    }
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Shimmer>Thinking…</Shimmer>}
          {error && (
            <p className="text-destructive text-sm">
              Something went wrong. Try again.
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl p-4">
        <PromptInput
          onSubmit={({ text }) => {
            const trimmed = text.trim();
            if (!trimmed || isBusy) return;
            void sendMessage({ text: trimmed });
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea placeholder="Describe the chapter, activity, or concept…" />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
