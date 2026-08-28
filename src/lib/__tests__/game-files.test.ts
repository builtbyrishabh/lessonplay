import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { deriveGameFiles, displayPath, languageFor } from "~/lib/game-files";

/** One assistant message carrying the given tool parts, in order. */
function assistant(...parts: unknown[]): UIMessage {
  return { id: "m1", role: "assistant", parts } as unknown as UIMessage;
}

const write = (
  path: string,
  content: string,
  state = "output-available",
) => ({ type: "tool-write", state, input: { path, content } });

const edit = (
  path: string,
  old_string: string,
  new_string: string,
  state = "output-available",
) => ({ type: "tool-edit", state, input: { path, old_string, new_string } });

describe("displayPath", () => {
  it("hides the sandbox from the teacher", () => {
    expect(displayPath("/home/daytona/game/src/scenario.ts")).toBe(
      "src/scenario.ts",
    );
    expect(displayPath("~/game/vite.config.ts")).toBe("vite.config.ts");
    expect(displayPath("src/levels.ts")).toBe("src/levels.ts");
    // Outside the game root, but still never shown with a leading slash.
    expect(displayPath("/home/daytona/engine/README.md")).toBe(
      "engine/README.md",
    );
  });
});

describe("languageFor", () => {
  it("maps extensions, and falls back rather than guessing", () => {
    expect(languageFor("src/scenario.ts")).toBe("typescript");
    expect(languageFor("app.tsx")).toBe("tsx");
    expect(languageFor("package.json")).toBe("json");
    expect(languageFor("Makefile")).toBe("text");
  });
});

describe("deriveGameFiles", () => {
  it("is empty for a conversation with no file writes", () => {
    const state = deriveGameFiles([
      assistant({ type: "text", text: "Let's plan the lab first." }),
      assistant({ type: "tool-bash", state: "output-available", input: {} }),
    ]);
    expect(state.files).toEqual([]);
    expect(state.activePath).toBeNull();
    expect(state.isWriting).toBe(false);
  });

  it("collects written files and follows the most recent one", () => {
    const state = deriveGameFiles([
      assistant(
        write("src/scenario.ts", "export const scenario = {};"),
        write("src/levels.ts", "export const levels = [];"),
      ),
    ]);

    // Listed alphabetically...
    expect(state.files.map((f) => f.path)).toEqual([
      "src/levels.ts",
      "src/scenario.ts",
    ]);
    // ...but the pane follows whatever was touched last, not the first name.
    expect(state.activePath).toBe("src/levels.ts");
    expect(state.isWriting).toBe(false);
  });

  it("exposes a half-streamed write so the file can be watched being typed", () => {
    const state = deriveGameFiles([
      assistant(write("src/scenario.ts", "export const scen", "input-streaming")),
    ]);

    expect(state.isWriting).toBe(true);
    expect(state.files[0]).toMatchObject({
      path: "src/scenario.ts",
      content: "export const scen",
      status: "writing",
    });
  });

  it("ignores a write whose path has not arrived yet", () => {
    // Partial JSON: the model has opened the object but not finished the first
    // key. Rendering this would flash an empty tab.
    const state = deriveGameFiles([
      assistant({ type: "tool-write", state: "input-streaming", input: {} }),
    ]);
    expect(state.files).toEqual([]);
  });

  it("applies an edit on top of the content it already has", () => {
    const state = deriveGameFiles([
      assistant(
        write("src/scenario.ts", "const salt = 'NaCl';"),
        edit("src/scenario.ts", "NaCl", "KCl"),
      ),
    ]);

    expect(state.files[0]).toMatchObject({
      content: "const salt = 'KCl';",
      status: "edited",
    });
  });

  it("does not invent content for a file it never saw whole", () => {
    // The agent copied a template with `bash`, then edited it. We have no
    // honest copy of that file, and showing the fragment would be a lie.
    const state = deriveGameFiles([
      assistant(edit("vite.config.ts", "port: 3000", "port: 4000")),
    ]);

    expect(state.files[0]).toMatchObject({
      path: "vite.config.ts",
      content: undefined,
      status: "stale",
    });
  });

  it("keeps the old content when an edit's search text does not match", () => {
    const state = deriveGameFiles([
      assistant(
        write("src/scenario.ts", "const salt = 'NaCl';"),
        edit("src/scenario.ts", "not-in-the-file", "x"),
      ),
    ]);

    // Marked edited (it did change on disk) but content is left alone rather
    // than silently diverging from the sandbox.
    expect(state.files[0]).toMatchObject({
      content: "const salt = 'NaCl';",
      status: "edited",
    });
  });

  it("lets a later write replace an earlier one", () => {
    const state = deriveGameFiles([
      assistant(write("src/levels.ts", "v1")),
      assistant(write("src/levels.ts", "v2")),
    ]);

    expect(state.files).toHaveLength(1);
    expect(state.files[0]!.content).toBe("v2");
  });

  it("normalises absolute and relative spellings of the same file", () => {
    const state = deriveGameFiles([
      assistant(
        write("src/levels.ts", "v1"),
        write("/home/daytona/game/src/levels.ts", "v2"),
      ),
    ]);

    // The model spells paths both ways; they must not become two tabs.
    expect(state.files).toHaveLength(1);
    expect(state.files[0]!.content).toBe("v2");
  });
});
