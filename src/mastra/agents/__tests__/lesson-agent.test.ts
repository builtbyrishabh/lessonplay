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
                inputTokens: {
                  total: 5,
                  noCache: 5,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
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

// Both agents below are built WITHOUT a sandboxPromise. Skills resolving here
// is the point of serving them from the app instead of a snapshot: the
// planner-only agent gets them, and nothing waits on a sandbox boot.
describe("skills", () => {
  it("resolves every skill directory in .agents/skills", async () => {
    const agent = await createLessonAgent({
      threadId: "t-skills",
      userId: "u1",
      model: textStreamModel("ok"),
    });

    const skills = await agent.listSkills();
    expect(skills.map((s) => s.name).sort()).toEqual([
      "chemquest-lab-game",
      "discovery-game-planner",
      "experiment-lab-game",
    ]);
    // The description is all the model sees before choosing one, so an empty
    // one would make the skill effectively invisible.
    for (const skill of skills) {
      expect(skill.description.length).toBeGreaterThan(40);
    }
  });

  it("reads a skill's instructions through Mastra, not a hand-rolled loader", async () => {
    const agent = await createLessonAgent({
      threadId: "t-skills-2",
      userId: "u1",
      model: textStreamModel("ok"),
    });

    const skill = await agent.getSkill("experiment-lab-game");
    expect(skill).toBeTruthy();
    // Front matter stripped, body intact.
    expect(skill!.instructions).toContain("# ExperimentLab Game");
    expect(skill!.instructions.startsWith("---")).toBe(false);
  });
});
