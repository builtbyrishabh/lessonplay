/**
 * The shape of a streamed tool part, and how to read it.
 *
 * Mastra streams each `tool-*` call as a part whose `input` JSON parses
 * incrementally — fields appear in key order while the arguments arrive.
 * Three views fold over these parts (the code pane via `deriveGameFiles`,
 * the BuildBlock, and the ToolCall rows); this is their one shared
 * vocabulary so "did this call fail, and what should we show?" has a single
 * answer everywhere.
 */

export type ToolPartLike = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** Read one string field off a partially-parsed tool input. */
export function stringField(input: unknown, key: string): string | undefined {
  const value = asRecord(input)?.[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * The failure message for a tool part, or null if it didn't fail.
 * Precedence: transport error text → stream error state → the tool's own
 * `{ ok: false }` output with its `message` (preferred) or `error`.
 */
export function failureOf(part: ToolPartLike): string | null {
  if (part.errorText) return part.errorText;
  if (part.state === "output-error") return "failed";
  const record = asRecord(part.output);
  if (record && record.ok === false) {
    return (
      (typeof record.message === "string" && record.message) ||
      (typeof record.error === "string" && record.error) ||
      "failed"
    );
  }
  return null;
}
