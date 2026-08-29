"use client";

import type { FileUIPart } from "ai";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SidebarToggleButton } from "~/components/layout/app-shell";
import { PromptBox } from "~/components/prompt-box";
import { useSettings } from "~/lib/hooks/use-settings";
import { lpMark } from "~/lib/perf";
import { setPendingPrompt } from "~/lib/pending-prompt";
import { newThreadId } from "~/lib/thread-id";
import { api } from "~/trpc/react";

export function HomeClient() {
  const router = useRouter();
  const utils = api.useUtils();
  const { settings, updateSettings } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Minted up front so an attachment can upload into this thread's prefix while
  // the teacher is still typing — the same id we then navigate to.
  const [draftThreadId] = useState(() => newThreadId());

  // Branch A (inline-optimized): nothing on the critical path is awaited, and
  // attachments finish uploading BEFORE send (PromptBox uploads on attach), so
  // the handoff carries ready file parts and the chat page dispatches at once.
  // - No `chats.create` round-trip — Mastra Memory upserts the thread on the
  //   first message, so creating it here was pure latency.
  // - The sidebar row is inserted optimistically (setData); the existing
  //   `onFinish` invalidate reconciles it once the reply — and the real,
  //   auto-titled thread — exists. We deliberately do NOT invalidate here: the
  //   thread does not exist server-side yet, so an immediate refetch would come
  //   back without it and wipe the optimistic row.
  const startChat = (text: string, files: FileUIPart[]) => {
    setError(null);
    setSubmitting(true);
    lpMark("submit");
    try {
      const threadId = draftThreadId;
      setPendingPrompt(threadId, { text, files });

      const now = new Date();
      utils.chats.list.setData(undefined, (prev) => [
        { id: threadId, title: "New chat", createdAt: now, updatedAt: now },
        ...(prev ?? []),
      ]);

      lpMark("navigate");
      router.push(`/chats/${threadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start chat.");
      setSubmitting(false);
    }
  };

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
            disabled={submitting}
            model={settings.model}
            onModelChange={(model) => updateSettings({ model })}
            onSubmit={startChat}
            placeholder="Paste a chapter section, an activity, or name a concept…"
            status={submitting ? "submitted" : "ready"}
            uploadThreadId={draftThreadId}
          />
          {error ? (
            <p className="text-destructive mt-2 px-1 text-sm">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
