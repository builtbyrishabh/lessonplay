import { describe, expect, it } from "vitest";

import { groupMessageParts, type MessagePart } from "~/lib/message-groups";

const part = (type: string, extra: Record<string, unknown> = {}) =>
  ({ type, ...extra }) as unknown as MessagePart;

describe("groupMessageParts", () => {
  it("folds consecutive writes and edits into one build block, across step-starts", () => {
    const groups = groupMessageParts("m", [
      part("step-start"),
      part("tool-write", { input: { path: "a.ts" } }),
      part("step-start"),
      part("tool-edit", { input: { path: "a.ts" } }),
      part("step-start"),
      part("tool-write", { input: { path: "b.ts" } }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("build");
    expect(groups[0]?.kind === "build" && groups[0].parts).toHaveLength(3);
  });

  it("breaks a run on text, reasoning, or any other tool", () => {
    const groups = groupMessageParts("m", [
      part("tool-write"),
      part("text", { text: "now validating" }),
      part("tool-validate"),
      part("tool-write"),
      part("tool-write"),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["build", "part", "part", "build"]);
  });

  it("folds consecutive reads separately from builds", () => {
    const groups = groupMessageParts("m", [
      part("tool-read"),
      part("tool-read"),
      part("tool-write"),
      part("tool-read"),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["reads", "build", "reads"]);
    expect(groups[0]?.kind === "reads" && groups[0].parts).toHaveLength(2);
  });

  it("keeps keys unique and stable across re-renders", () => {
    const parts = [part("tool-write"), part("text", { text: "x" }), part("tool-write")];
    const first = groupMessageParts("m", parts).map((g) => g.key);
    const second = groupMessageParts("m", parts).map((g) => g.key);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });
});
