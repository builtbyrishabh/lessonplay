"use client";

import type { FileUIPart } from "ai";
import { useQueryState } from "nuqs";
import { Suspense, useRef, useState } from "react";

import { ChatWorkspace } from "~/components/chat/chat-workspace";
import { SidebarToggleButton } from "~/components/layout/app-shell";
import { PromptBox } from "~/components/prompt-box";
import { type ChatSeed } from "~/lib/chat-seed";
import { lpMark } from "~/lib/perf";
import { newThreadId } from "~/lib/thread-id";
import { api } from "~/trpc/react";

/**
 * Branch B — the query-param SPA. One page holds both the home prompt and the
 * conversation; the active thread lives in `?id=`. Starting a chat flips that
 * param (`setActiveId`, shallow — no navigation, no server round-trip, no
 * remount of this page), so the conversation appears in the same frame instead
 * of after an RSC fetch. Switching threads from the sidebar is the same flip.
 */
function ChatsHarness() {
  const utils = api.useUtils();
  const [activeId, setActiveId] = useQueryState("id");

  // A prompt carried over from the public landing page. Read once to seed the
  // composer, then dropped from the URL when the chat starts.
  const [seedPrompt, setSeedPrompt] = useQueryState("q");

  // A thread id minted up front so a file can upload into its prefix before the
  // thread exists (see PromptBox). Re-minted after each new chat starts, so the
  // next chat — and any file attached for it — gets a fresh, uncollided id.
  const [draftThreadId, setDraftThreadId] = useState(() => newThreadId());

  // Threads created in THIS session skip the history query — they start empty
  // and are driven by the seed, so we never fetch (and never miss) for them.
  const recentlyCreatedRef = useRef<Set<string>>(new Set());

  // The first prompt, set synchronously by `startChat` and passed to the
  // conversation as a prop. Held in state (not a ref) so writing it triggers
  // the render that mounts the conversation.
  const [committedSeed, setCommittedSeed] = useState<ChatSeed | null>(null);

  const isFresh = activeId ? recentlyCreatedRef.current.has(activeId) : false;

  // Existing threads (opened from the sidebar or a shared link) load their
  // history client-side; freshly-created ones don't.
  const messagesQuery = api.chats.messages.useQuery(
    { threadId: activeId ?? "" },
    { enabled: Boolean(activeId) && !isFresh },
  );

  // Files arrive already uploaded — PromptBox uploads on attach and blocks send
  // until they're done — so the seed carries ready parts and the conversation
  // dispatches the first message with nothing on the critical path.
  const startChat = (text: string, files: FileUIPart[]) => {
    const threadId = draftThreadId;
    lpMark("submit");

    // Set synchronously, before the `?id=` flip below, so the seed is already
    // in state on the first render that shows the conversation — no gap frame.
    setCommittedSeed({ threadId, text, files });
    recentlyCreatedRef.current.add(threadId);

    const now = new Date();
    utils.chats.list.setData(undefined, (prev) => [
      { id: threadId, title: "New chat", createdAt: now, updatedAt: now },
      ...(prev ?? []),
    ]);

    lpMark("navigate");
    // Shallow by default: the URL changes, this page stays mounted, no RSC.
    void setActiveId(threadId);
    if (seedPrompt !== null) void setSeedPrompt(null);
    setDraftThreadId(newThreadId());
  };

  // No thread selected → the home surface.
  if (!activeId) {
    return (
      <div className="flex h-full flex-col px-4">
        <SidebarToggleButton className="mt-2 self-start" />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full max-w-2xl -translate-y-[8%]">
            <h1 className="text-foreground mb-8 text-center text-4xl font-semibold tracking-tight">
              What are you teaching?
            </h1>
            <PromptBox
              autoFocus
              defaultValue={seedPrompt ?? undefined}
              onSubmit={startChat}
              placeholder="Paste a chapter section, an activity, or name a concept…"
              uploadThreadId={draftThreadId}
            />
          </div>
        </div>
      </div>
    );
  }

  const seedForActive =
    committedSeed?.threadId === activeId ? committedSeed : null;

  if (!isFresh) {
    if (messagesQuery.isPending) return <ChatSkeleton />;
    if (messagesQuery.data) {
      return (
        <ChatWorkspace
          key={activeId}
          messages={messagesQuery.data.messages}
          threadId={activeId}
          title={messagesQuery.data.thread.title}
        />
      );
    }
    // Query errored (e.g. a thread that isn't ours) — fall through to empty.
  }

  return (
    <ChatWorkspace
      key={activeId}
      messages={[]}
      seed={seedForActive}
      threadId={activeId}
      title="New chat"
    />
  );
}

function ChatSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border/60 flex h-14 items-center gap-3 border-b px-4">
        <div className="bg-muted h-4 w-40 animate-pulse rounded" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <div className="bg-muted ml-auto h-16 w-2/3 animate-pulse rounded-2xl" />
        <div className="bg-muted/70 h-24 w-3/4 animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}

export default function ChatsPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatsHarness />
    </Suspense>
  );
}
