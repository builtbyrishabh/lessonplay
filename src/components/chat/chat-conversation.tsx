"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import { Message, MessageContent } from "~/components/ai-elements/message";
import { Shimmer } from "~/components/ai-elements/shimmer";
import { useChatContext } from "~/components/chat/chat-provider";
import { MessageParts } from "~/components/chat/message-parts";
import { PromptBox } from "~/components/prompt-box";
import { useSettings } from "~/lib/hooks/use-settings";

/**
 * The conversation column. Stream state lives in `ChatProvider` so the
 * workspace pane beside it can read the same messages.
 */
export function ChatConversation() {
  const { threadId, messages, status, stop, error, send, streamingMessageId } =
    useChatContext();
  const { settings, updateSettings } = useSettings();

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
          uploadThreadId={threadId}
        />
      </div>
    </div>
  );
}
