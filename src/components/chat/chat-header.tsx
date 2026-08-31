"use client";

import { useState } from "react";

import { SidebarToggleButton } from "~/components/layout/app-shell";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

/**
 * Thread title, plus the teacher's share link once a game exists.
 *
 * The link is `/play/<threadId>` — the app route that proxies
 * `current/index.html`, the one key every publish overwrites — so it keeps
 * working as the game is revised, can be handed to a class once, and never
 * exposes the bucket path (which embeds the owner's Clerk user id). The
 * preview pane deliberately uses the versioned bucket URL instead; see
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
  const sharePath = latest.data?.sharePath ?? null;

  const copy = async () => {
    if (!sharePath) return;
    try {
      // Absolute at copy time — the clipboard leaves this origin, the href
      // below doesn't have to.
      await navigator.clipboard.writeText(
        new URL(sharePath, window.location.origin).toString(),
      );
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
      {sharePath ? (
        <div className="flex shrink-0 items-center gap-1 px-3">
          <span className="text-muted-foreground hidden text-[11px] lg:inline">
            v{latest.data?.version}
          </span>
          <Button onClick={copy} size="sm" variant="ghost">
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a href={sharePath} rel="noopener noreferrer" target="_blank">
              Open
            </a>
          </Button>
        </div>
      ) : null}
    </header>
  );
}
