"use client";

import { useState } from "react";

import { useChatContext } from "~/components/chat/chat-provider";
import { CodeLines } from "~/components/chat/code-lines";
import { languageFor, type GameFile } from "~/lib/game-files";
import { CodeIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";

/**
 * The files the agent has authored, and the one it is writing right now.
 *
 * Content comes from the `write`/`edit` tool inputs in the message stream — so
 * while a `write` is mid-flight this re-renders on every chunk and the file
 * appears to be typed out. See `deriveGameFiles`.
 */
export function CodeView() {
  const { gameFiles } = useChatContext();
  const { files, activePath } = gameFiles;
  const [pinned, setPinned] = useState<string | null>(null);

  // Follow whatever the agent is touching, unless the teacher clicked a file.
  const selectedPath = pinned ?? activePath;
  const selected = files.find((f) => f.path === selectedPath) ?? null;

  if (files.length === 0) {
    return (
      <div className="bg-muted/30 flex h-full flex-col items-center justify-center gap-3 p-6">
        <CodeIcon className="text-muted-foreground/60" height={20} width={20} />
        <p className="text-muted-foreground max-w-xs text-center text-sm">
          Files the assistant writes will show up here as it builds.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b px-2">
        {files.map((file) => (
          <button
            className={cn(
              "shrink-0 rounded px-2 py-1 font-mono text-[11px] transition-colors",
              file.path === selectedPath
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            key={file.path}
            onClick={() => setPinned(file.path)}
            type="button"
          >
            {file.path}
            {file.status === "writing" ? (
              <span className="text-muted-foreground ml-1 animate-pulse">
                ●
              </span>
            ) : null}
          </button>
        ))}
        {pinned ? (
          <button
            className="text-muted-foreground hover:text-foreground ml-auto shrink-0 px-2 text-[11px]"
            onClick={() => setPinned(null)}
            type="button"
          >
            Follow agent
          </button>
        ) : null}
      </div>
      {selected ? <FileBody file={selected} /> : null}
    </div>
  );
}

function FileBody({ file }: { file: GameFile }) {
  if (file.content === undefined) {
    return (
      <div className="bg-muted/30 flex min-h-0 flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground max-w-xs text-center text-sm">
          This file was edited but never written in full here, so its contents
          are not available to show.
        </p>
      </div>
    );
  }

  return (
    <CodeLines
      className="flex-1"
      content={file.content}
      follow={file.status === "writing"}
      language={languageFor(file.path)}
    />
  );
}
