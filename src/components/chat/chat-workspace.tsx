"use client";

import type { UIMessage } from "ai";

import { ChatConversation } from "~/components/chat/chat-conversation";
import { ChatHeader } from "~/components/chat/chat-header";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";

/**
 * v0-clone layout: header, conversation column on the left, workspace on the
 * right, split by a draggable handle. The right pane will host the game
 * preview / files in a later slice.
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
      {/* Mobile: conversation only. */}
      <div className="min-h-0 flex-1 md:hidden">
        <ChatConversation initialMessages={messages} threadId={threadId} />
      </div>
      {/* Desktop: resizable split. */}
      <ResizablePanelGroup
        className="hidden min-h-0 flex-1 md:flex"
        orientation="horizontal"
      >
        <ResizablePanel defaultSize="38" maxSize="70" minSize={320}>
          <ChatConversation initialMessages={messages} threadId={threadId} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={320}>
          <div className="bg-muted/30 flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">
              Your lab preview will appear here.
            </p>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
