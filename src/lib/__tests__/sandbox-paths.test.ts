import { describe, expect, it } from "vitest";

import {
  sanitizeUploadFilename,
  uploadObjectKey,
  uploadsPrefix,
} from "~/lib/sandbox-paths";

describe("sanitizeUploadFilename", () => {
  it("keeps a plain name", () => {
    expect(sanitizeUploadFilename("chapter-3.pdf")).toBe("chapter-3.pdf");
  });

  it("strips any directory part", () => {
    expect(sanitizeUploadFilename("sub/dir/notes.txt")).toBe("notes.txt");
    expect(sanitizeUploadFilename("C:\\Users\\me\\notes.txt")).toBe(
      "notes.txt",
    );
  });

  it("defuses traversal attempts", () => {
    // ".." collapses to a leading-dot strip, never an escaping segment.
    expect(sanitizeUploadFilename("../../current/index.html")).toBe(
      "index.html",
    );
    expect(sanitizeUploadFilename("..")).toBe("file");
  });

  it("replaces unsafe characters and never returns empty", () => {
    expect(sanitizeUploadFilename("a b&c*.pdf")).toBe("a-b-c-.pdf");
    expect(sanitizeUploadFilename("")).toBe("file");
    expect(sanitizeUploadFilename("///")).toBe("file");
  });
});

describe("uploadObjectKey", () => {
  it("nests under the thread's uploads/ prefix", () => {
    expect(uploadsPrefix("user_1", "thread_1")).toBe(
      "games/user_1/thread_1/uploads",
    );
    expect(uploadObjectKey("user_1", "thread_1", "chapter.pdf")).toBe(
      "games/user_1/thread_1/uploads/chapter.pdf",
    );
  });
});
