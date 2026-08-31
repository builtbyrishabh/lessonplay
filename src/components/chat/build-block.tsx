"use client";

import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

import { MessageResponse } from "~/components/ai-elements/message";
import { Shimmer } from "~/components/ai-elements/shimmer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { deriveGameFiles, displayPath, languageFor } from "~/lib/game-files";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CodeIcon,
  SpinnerIcon,
} from "~/lib/icons";
import type { MessagePart } from "~/lib/message-groups";
import {
  failureOf,
  stringField,
  type ToolPartLike,
} from "~/lib/tool-parts";
import { cn } from "~/lib/utils";

/**
 * A run of `write` / `edit` calls, shown as one block in the conversation.
 *
 * While the agent is writing, the block is open and types out the file it is
 * on — the same partial tool input the code pane follows — so the centre of
 * the screen is never blank during a build. Once the run is over it collapses
 * to a one-line count. No file names anywhere: which files, and what is in
 * each, is the Code tab's job; this is the teacher watching work happen.
 *
 * The code is rendered as an ordinary markdown code block through the same
 * Streamdown the prose uses, so it looks like code the assistant said rather
 * than a second editor.
 */

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function BuildBlock({
  messageId,
  parts,
}: {
  messageId: string;
  parts: MessagePart[];
}) {
  // Same fold the code pane uses, over just this run — so the content shown
  // here and there is the same data, chunk for chunk.
  const state = useMemo(
    () =>
      deriveGameFiles([
        { id: messageId, role: "assistant", parts } as UIMessage,
      ]),
    [messageId, parts],
  );
  const { files, activePath, isWriting } = state;
  const active = files.find((f) => f.path === activePath) ?? null;

  const toolParts = parts as ToolPartLike[];
  // Just the messages — no paths, same as everywhere else in this block.
  const failures = [
    ...new Set(
      toolParts.map(failureOf).filter((f): f is string => f !== null),
    ),
  ];

  // Wrote vs updated: a file first written in this run is "wrote", even if it
  // was edited afterwards; one only edited here is "updated".
  const written = new Set<string>();
  const edited = new Set<string>();
  for (const p of toolParts) {
    const path = stringField(p.input, "path");
    if (!path) continue;
    if (p.type === "tool-write") written.add(displayPath(path));
    else if (!written.has(displayPath(path))) edited.add(displayPath(path));
  }
  const lineCount = files.reduce(
    (n, f) => n + (f.content ? f.content.split("\n").length : 0),
    0,
  );

  // While writing the block follows along; once done it collapses. The teacher
  // can override either way, and that choice sticks for the block.
  const [pinnedOpen, setPinnedOpen] = useState<boolean | null>(null);
  const open = pinnedOpen ?? isWriting;

  // What to show in the body: the file being written in full, or, for an edit
  // to a file this run never wrote whole, the replacement text on its own.
  const lastEdit = [...toolParts]
    .reverse()
    .find((p) => p.type === "tool-edit" && stringField(p.input, "new_string"));
  const body =
    active?.content !== undefined
      ? { content: active.content, language: languageFor(active.path) }
      : lastEdit
        ? {
            content: stringField(lastEdit.input, "new_string") ?? "",
            language: languageFor(stringField(lastEdit.input, "path") ?? ""),
          }
        : null;

  const summary = isWriting
    ? null
    : [
        written.size ? `Wrote ${plural(written.size, "file")}` : null,
        edited.size ? `Updated ${plural(edited.size, "file")}` : null,
      ]
        .filter(Boolean)
        .join(", ") || "Wrote files";

  const failed = failures.length > 0;

  return (
    <Collapsible
      className={cn(
        "border-border/60 bg-muted/20 rounded-lg border",
        failed && "border-destructive/40 bg-destructive/5",
      )}
      onOpenChange={setPinnedOpen}
      open={open}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left">
        <span className="text-muted-foreground shrink-0">
          {open ? (
            <ChevronDownIcon height={12} width={12} />
          ) : (
            <ChevronRightIcon height={12} width={12} />
          )}
        </span>
        <span
          className={cn(
            "shrink-0",
            failed ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {isWriting ? (
            <SpinnerIcon className="animate-spin" height={13} width={13} />
          ) : (
            <CodeIcon height={13} width={13} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px]">
          {isWriting ? (
            <Shimmer>Writing the game</Shimmer>
          ) : (
            <span className={failed ? "text-destructive" : "text-foreground"}>
              {summary}
            </span>
          )}
        </span>
        {!isWriting && lineCount > 0 ? (
          <span className="text-muted-foreground shrink-0 text-[11px]">
            {lineCount.toLocaleString()} lines
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {body ? (
          <FencedCode
            content={body.content}
            follow={isWriting}
            language={body.language}
          />
        ) : null}
        {failed ? (
          <pre className="text-destructive border-border/60 border-t px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {failures.join("\n")}
          </pre>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * One fenced code block, kept scrolled to the newest line while it streams.
 * Streamdown copes with the unterminated fence a mid-stream file is.
 */
function FencedCode({
  content,
  language,
  follow,
}: {
  content: string;
  language: string;
  follow: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!follow) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [content, follow]);

  return (
    <div
      className="border-border/60 max-h-80 overflow-auto border-t px-2.5 py-2 [&_pre]:text-[11px]"
      ref={scrollRef}
    >
      <MessageResponse>{`\`\`\`${language}\n${content}\n\`\`\``}</MessageResponse>
    </div>
  );
}
