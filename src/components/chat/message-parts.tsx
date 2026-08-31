"use client";

import type { UIMessage } from "ai";
import { useMemo } from "react";

import { MessageResponse } from "~/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "~/components/ai-elements/reasoning";
import { BuildBlock } from "~/components/chat/build-block";
import { ReadGroup, ToolCall } from "~/components/chat/tool-call";
import { FileTextIcon } from "~/lib/icons";
import { groupMessageParts } from "~/lib/message-groups";

/**
 * Renders one message's parts: prose, reasoning, and the agent's tool calls.
 *
 * File writes and reads are folded into runs first (`groupMessageParts`), so a
 * build turn reads as "wrote the game" with the code inline, not as a list of
 * every path the agent touched.
 */
export function MessageParts({
  message,
  isStreaming = false,
}: {
  message: UIMessage;
  isStreaming?: boolean;
}) {
  const lastIndex = message.parts.length - 1;
  const groups = useMemo(
    () => groupMessageParts(message.id, message.parts),
    [message.id, message.parts],
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      {groups.map((group) => {
        if (group.kind === "build") {
          return (
            <BuildBlock
              key={group.key}
              messageId={message.id}
              parts={group.parts}
            />
          );
        }
        if (group.kind === "reads") {
          // A lone read is more useful as its own row (it carries the error).
          return group.parts.length === 1 ? (
            <ToolCall key={group.key} part={group.parts[0]!} />
          ) : (
            <ReadGroup key={group.key} parts={group.parts} />
          );
        }

        const { key, part, index } = group;

        // Tool parts are typed per tool (`tool-write`, `tool-publish`, …) rather
        // than sharing one `type`, so they are matched by prefix instead of
        // being listed — a new tool shows up in the UI without a change here.
        if (part.type.startsWith("tool-")) {
          return <ToolCall key={key} part={part} />;
        }

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
          case "file":
            // The signed URL expires, so this is a label, not a working link —
            // just enough for the teacher to see what they attached.
            return (
              <span
                className="border-border bg-muted text-muted-foreground flex w-fit items-center gap-1.5 rounded-lg border px-2 py-1 text-xs"
                key={key}
              >
                <FileTextIcon className="size-3.5 shrink-0" />
                <span className="max-w-64 truncate">
                  {part.filename ?? "attachment"}
                </span>
              </span>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
