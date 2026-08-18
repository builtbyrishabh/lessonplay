import { Mastra } from "@mastra/core";
import { InMemoryStore } from "@mastra/core/storage";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Swap the Postgres-backed container for an in-memory one. Everything else
// (Memory, factory, prompt) is exercised for real.
vi.mock("~/mastra", () => {
  const storage = new InMemoryStore();
  return { storage, mastra: new Mastra({ agents: {}, storage }) };
});

import { createLessonAgent } from "../lesson-agent";
import { getLessonMemory } from "../lesson-memory";

function textStreamModel(reply: string) {
  return new MockLanguageModelV3({
    doStream: async ({ prompt }) => {
      // Expose the prompt so tests can assert what the model saw.
      seenPrompts.push(prompt);
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({ type: "text-start", id: "t1" });
            controller.enqueue({ type: "text-delta", id: "t1", delta: reply });
            controller.enqueue({ type: "text-end", id: "t1" });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage: {
                inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 3, text: 3, reasoning: 0 },
              },
            });
            controller.close();
          },
        }),
      };
    },
  });
}

let seenPrompts: unknown[] = [];

describe("createLessonAgent", () => {
  const userId = "user_test";
  const threadId = "thread-abc-12345";

  beforeEach(() => {
    seenPrompts = [];
  });

  it("builds an agent that streams and persists to memory", async () => {
    // Explicit-create mirrors what the chats.create tRPC procedure does.
    await getLessonMemory().createThread({ threadId, resourceId: userId });

    const agent = await createLessonAgent({
      threadId,
      userId,
      model: textStreamModel("Hello teacher"),
    });

    const stream = await agent.stream("Hi, I teach acids and bases", {
      // Title generation would need a second model call; keep the test focused.
      memory: {
        thread: threadId,
        resource: userId,
        options: { generateTitle: false },
      },
    });
    expect(await stream.text).toBe("Hello teacher");

    const { messages } = await getLessonMemory().recall({
      threadId,
      resourceId: userId,
      perPage: false,
    });
    const roles = messages.map((m) => m.role);
    expect(roles).toEqual(["user", "assistant"]);
  });

  it("feeds prior turns from memory into the next request", async () => {
    const agent = await createLessonAgent({
      threadId,
      userId,
      model: textStreamModel("Second reply"),
    });
    await (
      await agent.stream("Follow-up question", {
        memory: {
          thread: threadId,
          resource: userId,
          options: { generateTitle: false },
        },
      })
    ).text;

    const lastPrompt = JSON.stringify(seenPrompts.at(-1));
    expect(lastPrompt).toContain("Hi, I teach acids and bases");
    expect(lastPrompt).toContain("Hello teacher");
    expect(lastPrompt).toContain("Follow-up question");
  });

  it("logs build timing through the trace hook", async () => {
    const events: string[] = [];
    await createLessonAgent({
      threadId,
      userId,
      model: textStreamModel("x"),
      trace: { id: "t", log: (e) => events.push(e) },
    });
    expect(events).toEqual(["agent.build.start", "agent.build.end"]);
  });
});
