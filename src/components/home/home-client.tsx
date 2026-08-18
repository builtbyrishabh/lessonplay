"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SidebarToggleButton } from "~/components/layout/app-shell";
import { PromptBox } from "~/components/prompt-box";
import { useSettings } from "~/lib/hooks/use-settings";
import { setPendingPrompt } from "~/lib/pending-prompt";
import { api } from "~/trpc/react";

export function HomeClient() {
  const router = useRouter();
  const utils = api.useUtils();
  const { settings, updateSettings } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const create = api.chats.create.useMutation();

  const startChat = async (text: string) => {
    setError(null);
    try {
      const { id } = await create.mutateAsync();
      setPendingPrompt(id, text);
      await utils.chats.list.invalidate();
      router.push(`/chats/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start chat.");
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
            disabled={create.isPending}
            model={settings.model}
            onModelChange={(model) => updateSettings({ model })}
            onSubmit={startChat}
            placeholder="Paste a chapter section, an activity, or name a concept…"
            status={create.isPending ? "submitted" : "ready"}
          />
          {error ? (
            <p className="text-destructive mt-2 px-1 text-sm">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
