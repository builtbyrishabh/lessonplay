"use client";

import type { UIMessage } from "ai";

import { ChatConversation } from "~/components/chat/chat-conversation";
import { ChatHeader } from "~/components/chat/chat-header";
import { ChatProvider } from "~/components/chat/chat-provider";
import type { ChatSeed } from "~/lib/chat-seed";
import { WorkspacePane } from "~/components/chat/workspace-pane";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";

/**
 * v0-clone layout: header, conversation column on the left, workspace on the
 * right, split by a draggable handle.
 *
 * `ChatProvider` wraps both columns rather than sitting inside the
 * conversation: the workspace pane reads the same stream to show the file the
 * agent is writing, and the header reads it to offer the share link.
 */
export function ChatWorkspace({
  threadId,
  title,
  messages,
  seed = null,
}: {
  threadId: string;
  title: string;
  messages: UIMessage[];
  /** First prompt to auto-send on a freshly-created thread (Branch B). */
  seed?: ChatSeed | null;
}) {
  return (
    <ChatProvider initialMessages={messages} seed={seed} threadId={threadId}>
      <div className="flex h-full min-h-0 flex-col">
        <ChatHeader threadId={threadId} title={title} />
        {/* Mobile: conversation only. */}
        <div className="min-h-0 flex-1 md:hidden">
          <ChatConversation />
        </div>
        {/* Desktop: resizable split. */}
        <ResizablePanelGroup
          className="hidden min-h-0 flex-1 md:flex"
          orientation="horizontal"
        >
          <ResizablePanel defaultSize="38" maxSize="70" minSize={320}>
            <ChatConversation />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel minSize={320}>
            <WorkspacePane threadId={threadId} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </ChatProvider>
  );
}
