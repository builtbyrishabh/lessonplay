import type { UIMessage } from "ai";

/**
 * How one assistant message's parts are folded for display.
 *
 * A build turn is dozens of parts — a `write`, a `step-start`, another
 * `write`… — and rendering each as its own row turned the conversation into a
 * file listing while the code itself sat in the other pane. Consecutive file
 * writes are folded into ONE block that shows the code being typed, and
 * consecutive reads into one line, so the column stays readable and the
 * teacher can see the game being written where they are looking.
 */

export type MessagePart = UIMessage["parts"][number];

export type PartGroup =
  /** A run of `write` / `edit` calls: one inline code block. */
  | { kind: "build"; key: string; parts: MessagePart[] }
  /** A run of `read` calls: one "looked at N files" line. */
  | { kind: "reads"; key: string; parts: MessagePart[] }
  /** Anything else, rendered on its own. */
  | { kind: "part"; key: string; part: MessagePart; index: number };

const BUILD_TYPES = new Set(["tool-write", "tool-edit"]);

/**
 * `step-start` separates every tool call from the next, so without skipping
 * it no two writes would ever be adjacent. It renders as nothing anyway.
 */
function isTransparent(part: MessagePart): boolean {
  return part.type === "step-start";
}

export function groupMessageParts(
  messageId: string,
  parts: readonly MessagePart[],
): PartGroup[] {
  const groups: PartGroup[] = [];
  let open: Extract<PartGroup, { kind: "build" | "reads" }> | null = null;

  for (const [index, part] of parts.entries()) {
    if (isTransparent(part)) continue;

    const run: "build" | "reads" | null = BUILD_TYPES.has(part.type)
      ? "build"
      : part.type === "tool-read"
        ? "reads"
        : null;

    if (run === null) {
      open = null;
      groups.push({ kind: "part", key: `${messageId}-${index}`, part, index });
      continue;
    }

    if (open !== null && open.kind === run) {
      open.parts.push(part);
      continue;
    }
    const key: string = `${messageId}-${run}-${index}`;
    const group: Extract<PartGroup, { kind: "build" | "reads" }> =
      run === "build"
        ? { kind: "build", key, parts: [part] }
        : { kind: "reads", key, parts: [part] };
    open = group;
    groups.push(group);
  }

  return groups;
}
