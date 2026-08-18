"use client";

import type { UIMessage } from "ai";

import { ChatConversation } from "~/components/chat/chat-conversation";
import { ChatHeader } from "~/components/chat/chat-header";

/**
 * v0-clone layout: header, conversation column on the left, workspace on the
 * right. The right pane will host the game preview / files in a later slice.
 */
export function ChatWorkspace({
  threadId,
  title,
  messages,
}: {
  threadId: string;
  title: string;
  messages: UIMessage[];
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader title={title} />
      <div className="flex min-h-0 flex-1">
        <div className="border-border flex w-full shrink-0 flex-col md:w-80 md:max-w-[42%] md:border-r">
          <ChatConversation initialMessages={messages} threadId={threadId} />
        </div>
        <div className="bg-muted/30 hidden min-w-0 flex-1 items-center justify-center md:flex">
          <p className="text-muted-foreground text-sm">
            Your lab preview will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
