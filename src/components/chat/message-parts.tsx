"use client";

import type { UIMessage } from "ai";

import { MessageResponse } from "~/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "~/components/ai-elements/reasoning";

/** Renders one message's parts. Tool/data parts arrive in later slices. */
export function MessageParts({
  message,
  isStreaming = false,
}: {
  message: UIMessage;
  isStreaming?: boolean;
}) {
  const lastIndex = message.parts.length - 1;

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        switch (part.type) {
          case "text":
            return part.text ? (
              <MessageResponse key={key}>{part.text}</MessageResponse>
            ) : null;
          case "reasoning":
            return (
              <Reasoning
                isStreaming={isStreaming && index === lastIndex}
                key={key}
              >
                <ReasoningTrigger />
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
