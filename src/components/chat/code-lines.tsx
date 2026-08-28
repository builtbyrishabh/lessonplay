"use client";

import { useEffect, useRef } from "react";

import { cn } from "~/lib/utils";

/**
 * Numbered source lines, shared by the code pane and the inline build block.
 *
 * With `follow` the newest line is kept in view, the way a terminal does, so a
 * file being streamed in looks typed. Only while following — otherwise reading
 * a file would fight the scrollbar.
 */
export function CodeLines({
  content,
  language,
  follow = false,
  className,
}: {
  content: string;
  language: string;
  follow?: boolean;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!follow) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [content, follow]);

  const lines = content.split("\n");

  return (
    <div className={cn("min-h-0 overflow-auto", className)} ref={scrollRef}>
      <pre
        className="text-foreground p-3 font-mono text-[11px] leading-[1.6]"
        data-language={language}
      >
        <code>
          {lines.map((line, index) => (
            <div className="flex" key={index}>
              <span className="text-muted-foreground/50 mr-3 inline-block w-8 shrink-0 text-right select-none">
                {index + 1}
              </span>
              <span className="min-w-0 break-all whitespace-pre-wrap">
                {line || " "}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
