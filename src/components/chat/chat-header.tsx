"use client";

import { useState } from "react";

import { SidebarToggleButton } from "~/components/layout/app-shell";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

/**
 * Thread title, plus the teacher's share link once a game exists.
 *
 * The link is `current/index.html` — the one key every publish overwrites — so
 * it keeps working as the game is revised and can be handed to a class once.
 * The preview pane deliberately uses the versioned URL instead; see
 * `GamePreview`.
 */
export function ChatHeader({
  title,
  threadId,
}: {
  title: string;
  threadId: string;
}) {
  const latest = api.games.latest.useQuery({ threadId });
  const [copied, setCopied] = useState(false);
  const shareUrl = latest.data?.shareUrl ?? null;

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure origin, denied permission) — the Open
      // button beside this still gets them to the game.
    }
  };

  return (
    <header className="border-border flex h-12 shrink-0 items-center border-b">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <SidebarToggleButton />
        <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
          {title}
        </span>
      </div>
      {shareUrl ? (
        <div className="flex shrink-0 items-center gap-1 px-3">
          <span className="text-muted-foreground hidden text-[11px] lg:inline">
            v{latest.data?.version}
          </span>
          <Button onClick={copy} size="sm" variant="ghost">
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a href={shareUrl} rel="noopener noreferrer" target="_blank">
              Open
            </a>
          </Button>
        </div>
      ) : null}
    </header>
  );
}
