"use client";

import { useState } from "react";

import { Shimmer } from "~/components/ai-elements/shimmer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { displayPath } from "~/lib/game-files";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CodeIcon,
  EyeIcon,
  SparklesIcon,
  SpinnerIcon,
} from "~/lib/icons";
import { cn } from "~/lib/utils";

/**
 * One tool call, as the teacher sees it.
 *
 * The headline comes from the tool's FIRST input field — `intent` for `bash`,
 * `validate` and `publish`, `path` for the file tools. That ordering is
 * deliberate in the tool schemas: partial JSON parses in key order, so the
 * headline is readable while the rest of the arguments are still arriving, and
 * the row never shows a bare "calling a tool…".
 */

type ToolPartLike = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

const TOOL_LABELS: Record<string, string> = {
  bash: "Running",
  read: "Reading",
  write: "Writing",
  edit: "Editing",
  validate: "Checking",
  publish: "Publishing",
};

function field(input: unknown, key: string): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function toolNameOf(type: string): string {
  return type.startsWith("tool-") ? type.slice("tool-".length) : type;
}

/** The one line that describes what this call is doing. */
function headline(name: string, input: unknown): string {
  const intent = field(input, "intent");
  if (intent) return intent;
  const path = field(input, "path");
  if (path) return displayPath(path);
  const command = field(input, "command");
  if (command) return command;
  return TOOL_LABELS[name] ?? name;
}

function IconFor({ name }: { name: string }) {
  const size = 13;
  if (name === "publish") return <SparklesIcon height={size} width={size} />;
  if (name === "validate") return <EyeIcon height={size} width={size} />;
  return <CodeIcon height={size} width={size} />;
}

/** Human-readable one-liner for a finished call, from its typed output. */
function resultSummary(name: string, output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const record = output as Record<string, unknown>;

  if (name === "publish") {
    if (record.ok === true && typeof record.version === "number") {
      return `Published version ${record.version}`;
    }
    return "Not published";
  }
  if (name === "validate") {
    if (record.ok === true) return "Passed";
    const errors = record.errors;
    const count = Array.isArray(errors) ? errors.length : 0;
    return count ? `${count} problem${count === 1 ? "" : "s"}` : "Failed";
  }
  if (name === "bash" && typeof record.exitCode === "number") {
    return record.exitCode === 0 ? "Done" : `Exit ${record.exitCode}`;
  }
  if (name === "write" && typeof record.bytesWritten === "number") {
    return `${record.bytesWritten.toLocaleString()} bytes`;
  }
  if (name === "edit" && typeof record.replacements === "number") {
    return `${record.replacements} replacement${record.replacements === 1 ? "" : "s"}`;
  }
  if (record.ok === false) return "Failed";
  return null;
}

/** The detail body: whatever is most useful to a teacher debugging a failure. */
function detailText(name: string, part: ToolPartLike): string | null {
  if (part.errorText) return part.errorText;
  const output = part.output;
  if (typeof output !== "object" || output === null) return null;
  const record = output as Record<string, unknown>;

  if (name === "bash" && typeof record.output === "string") {
    return record.output.trim() || null;
  }
  if (typeof record.message === "string") {
    const errors = record.errors;
    if (Array.isArray(errors) && errors.length) {
      return [record.message, "", ...errors.map((e) => `• ${String(e)}`)].join(
        "\n",
      );
    }
    return record.message;
  }
  if (typeof record.error === "string") return record.error;
  return null;
}

/**
 * A run of `read` calls as one line — "Looked at 4 files" — with the paths
 * behind a chevron. Which files the agent glanced at is rarely what a teacher
 * wants to scan past; that it looked, and whether any read failed, is.
 */
export function ReadGroup({ parts }: { parts: ToolPartLike[] }) {
  const [open, setOpen] = useState(false);
  const running = parts.some(
    (p) => p.state === "input-streaming" || p.state === "input-available",
  );
  const rows = parts.map((p) => {
    const path = field(p.input, "path");
    const error =
      p.errorText ??
      (typeof p.output === "object" &&
      p.output !== null &&
      (p.output as Record<string, unknown>).ok === false
        ? String((p.output as Record<string, unknown>).error ?? "failed")
        : null);
    return { path: path ? displayPath(path) : "…", error };
  });
  const failures = rows.filter((r) => r.error).length;
  const count = rows.length;
  const title = running
    ? `Reading ${count === 1 ? "a file" : `${count} files`}`
    : `Looked at ${count} file${count === 1 ? "" : "s"}`;

  return (
    <Collapsible
      className={cn(
        "border-border/60 bg-muted/20 rounded-lg border",
        failures > 0 && "border-destructive/40 bg-destructive/5",
      )}
      onOpenChange={setOpen}
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
        <span className="text-muted-foreground shrink-0">
          {running ? (
            <SpinnerIcon className="animate-spin" height={13} width={13} />
          ) : (
            <EyeIcon height={13} width={13} />
          )}
        </span>
        <span className="text-foreground min-w-0 flex-1 truncate text-[12px]">
          {running ? <Shimmer>{title}</Shimmer> : title}
        </span>
        {failures > 0 ? (
          <span className="text-destructive shrink-0 text-[11px]">
            {failures} failed
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="border-border/60 border-t px-2.5 py-2 font-mono text-[11px] leading-relaxed">
          {rows.map((row, index) => (
            <li
              className={cn(
                "truncate",
                row.error ? "text-destructive" : "text-muted-foreground",
              )}
              key={index}
            >
              {row.path}
              {row.error ? ` — ${row.error}` : ""}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ToolCall({ part }: { part: ToolPartLike }) {
  const [open, setOpen] = useState(false);
  const name = toolNameOf(part.type);
  const running =
    part.state === "input-streaming" || part.state === "input-available";
  const failed =
    part.state === "output-error" ||
    (typeof part.output === "object" &&
      part.output !== null &&
      (part.output as Record<string, unknown>).ok === false);

  const title = headline(name, part.input);
  const summary = running ? null : resultSummary(name, part.output);
  const detail = running ? null : detailText(name, part);

  const header = (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          "shrink-0",
          failed ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {running ? (
          <SpinnerIcon className="animate-spin" height={13} width={13} />
        ) : (
          <IconFor name={name} />
        )}
      </span>
      <span className="text-muted-foreground shrink-0 text-[11px] font-medium tracking-wide uppercase">
        {TOOL_LABELS[name] ?? name}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[12px]",
          failed ? "text-destructive" : "text-foreground",
        )}
      >
        {running ? <Shimmer>{title}</Shimmer> : title}
      </span>
      {summary ? (
        <span
          className={cn(
            "shrink-0 text-[11px]",
            failed ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {summary}
        </span>
      ) : null}
    </div>
  );

  // Nothing to expand — a plain row, not a dead-looking button.
  if (!detail) {
    return (
      <div className="border-border/60 bg-muted/20 rounded-lg border px-2.5 py-1.5">
        {header}
      </div>
    );
  }

  return (
    <Collapsible
      className={cn(
        "border-border/60 bg-muted/20 rounded-lg border",
        failed && "border-destructive/40 bg-destructive/5",
      )}
      onOpenChange={setOpen}
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
        <div className="min-w-0 flex-1">{header}</div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="text-muted-foreground border-border/60 max-h-72 overflow-auto border-t px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
          {detail}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
