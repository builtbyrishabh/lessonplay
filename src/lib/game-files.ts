import type { UIMessage } from "ai";

import { GAME_ROOT, SANDBOX_HOME } from "./sandbox-paths";
import { stringField, type ToolPartLike } from "./tool-parts";

/**
 * The code pane's state, derived entirely from the message stream.
 *
 * There is no server call here on purpose. Every byte the agent writes went
 * through the `write` and `edit` tools, and those tool calls are already in the
 * conversation — so the file the teacher watches being typed is the same data
 * the model sent, not a poll of the sandbox. It also means the view survives a
 * page reload for free: Memory replays the tool parts.
 *
 * The tradeoff is that this reflects what the agent *wrote*, not what is on
 * disk. A file changed by a `bash` command (a `cp`, an `npm init`) will not
 * appear. That is the right bias for a "watch it build" pane — it shows
 * authored work — but it is why nothing here is treated as authoritative.
 */

export type GameFileStatus = "writing" | "written" | "edited" | "stale";

export type GameFile = {
  /** Display path, relative to the game root (e.g. "src/scenario.ts"). */
  path: string;
  /**
   * Best-known content. Undefined when the file was only ever edited, so we
   * never saw it whole — the pane shows a placeholder rather than a guess.
   */
  content?: string;
  status: GameFileStatus;
  /** Index of the last part that touched it; drives "most recently active". */
  order: number;
};

export type GameFilesState = {
  files: GameFile[];
  /** The file to show by default: whatever was touched last. */
  activePath: string | null;
  /** True while a `write` is mid-stream — the pane follows along live. */
  isWriting: boolean;
};

/** Strip the sandbox prefix so the teacher never sees /home/daytona. */
export function displayPath(raw: string): string {
  const trimmed = raw.trim();
  const absolute = trimmed.startsWith("~/")
    ? `${SANDBOX_HOME}/${trimmed.slice(2)}`
    : trimmed;
  if (absolute.startsWith(`${GAME_ROOT}/`)) {
    return absolute.slice(GAME_ROOT.length + 1);
  }
  if (absolute.startsWith(`${SANDBOX_HOME}/`)) {
    return absolute.slice(SANDBOX_HOME.length + 1);
  }
  return absolute.replace(/^\/+/, "");
}

/** Pick a Streamdown/shiki language from the extension. */
export function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    css: "css",
    html: "html",
    md: "markdown",
    sh: "bash",
    yml: "yaml",
    yaml: "yaml",
  };
  return map[ext] ?? "text";
}

/**
 * Fold every `write` and `edit` tool call in the conversation into a file list.
 *
 * Order matters: later calls overwrite earlier ones, which is what makes the
 * newest content win after several passes over the same file.
 */
export function deriveGameFiles(messages: UIMessage[]): GameFilesState {
  const byPath = new Map<string, GameFile>();
  let order = 0;
  let isWriting = false;

  for (const message of messages) {
    for (const rawPart of message.parts) {
      const part = rawPart as ToolPartLike;
      if (part.type !== "tool-write" && part.type !== "tool-edit") continue;

      const rawPath = stringField(part.input, "path");
      // During `input-streaming` the JSON is parsed incrementally, so `path`
      // can genuinely be absent for the first few tokens. Skip until it lands.
      if (!rawPath) continue;

      const path = displayPath(rawPath);
      order += 1;
      const streaming = part.state === "input-streaming";
      if (streaming) isWriting = true;

      if (part.type === "tool-write") {
        byPath.set(path, {
          path,
          content: stringField(part.input, "content") ?? "",
          status: streaming ? "writing" : "written",
          order,
        });
        continue;
      }

      // An edit. Apply it to what we already hold so the pane keeps showing
      // real content; if we never saw the file whole, or the search text is not
      // in our copy, say so rather than showing something that was never true.
      const previous = byPath.get(path);
      const oldString = stringField(part.input, "old_string");
      const newString = stringField(part.input, "new_string") ?? "";

      if (
        previous?.content !== undefined &&
        oldString &&
        previous.content.includes(oldString)
      ) {
        byPath.set(path, {
          path,
          content: previous.content.replace(oldString, newString),
          status: streaming ? "writing" : "edited",
          order,
        });
      } else {
        byPath.set(path, {
          path,
          content: previous?.content,
          status: previous?.content === undefined ? "stale" : "edited",
          order,
        });
      }
    }
  }

  const files = [...byPath.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  const newest = files.reduce<GameFile | null>(
    (best, file) => (!best || file.order > best.order ? file : best),
    null,
  );

  return { files, activePath: newest?.path ?? null, isWriting };
}
