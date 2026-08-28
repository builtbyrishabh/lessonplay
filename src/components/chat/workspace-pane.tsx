"use client";

import { useEffect, useRef, useState } from "react";

import { useChatContext } from "~/components/chat/chat-provider";
import { CodeView } from "~/components/chat/code-view";
import { GamePreview } from "~/components/chat/game-preview";
import { cn } from "~/lib/utils";

export type WorkspaceTab = "preview" | "code";

/**
 * The right-hand pane: the published game, or the code being written.
 *
 * It switches on its own as the agent works — to Code the moment a file starts
 * streaming, back to Preview once a publish lands — because the interesting
 * thing to watch changes during a build. A teacher who picks a tab themselves
 * takes over, and it stops moving under them.
 */
export function WorkspacePane({ threadId }: { threadId: string }) {
  const { gameFiles, status } = useChatContext();
  const [tab, setTab] = useState<WorkspaceTab>("preview");
  const [pinned, setPinned] = useState(false);
  const wasWritingRef = useRef(false);

  useEffect(() => {
    if (pinned) return;
    if (gameFiles.isWriting) {
      wasWritingRef.current = true;
      setTab("code");
      return;
    }
    // The turn is over and we had been writing: the game may have just been
    // published, so put the result back in front of them.
    if (wasWritingRef.current && status === "ready") {
      wasWritingRef.current = false;
      setTab("preview");
    }
  }, [gameFiles.isWriting, status, pinned]);

  const choose = (next: WorkspaceTab) => {
    setPinned(true);
    setTab(next);
  };

  return (
    <div className="bg-background flex h-full min-h-0 flex-col">
      <div className="border-border flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <TabButton
          active={tab === "preview"}
          label="Preview"
          onClick={() => choose("preview")}
        />
        <TabButton
          active={tab === "code"}
          badge={gameFiles.files.length || undefined}
          label="Code"
          onClick={() => choose("code")}
        />
      </div>
      <div className="min-h-0 flex-1">
        {tab === "preview" ? (
          <GamePreview
            isBuilding={status === "streaming" || status === "submitted"}
            threadId={threadId}
          />
        ) : (
          <CodeView />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
      {badge ? (
        <span className="text-muted-foreground text-[10px]">{badge}</span>
      ) : null}
    </button>
  );
}
