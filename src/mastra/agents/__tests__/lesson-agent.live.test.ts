/**
 * Live smoke test: real AI Gateway model + real Postgres through the factory.
 * Run: LIVE_MODEL=1 AI_GATEWAY_API_KEY=... DATABASE_URL=... npx vitest run lesson-agent.live
 * Optionally LIVE_MODEL_ID=<allow-listed id> to target one model; anything not
 * in LESSON_MODELS resolves to the default.
 */
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

const enabled = !!process.env.LIVE_MODEL && !!process.env.AI_GATEWAY_API_KEY && !!process.env.DATABASE_URL;

// Public fixtures whose content the assertions can name. The PDF's only text is
// "Dummy PDF file"; the image is the Next.js "N" logo.
const PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const IMAGE_URL = "https://assets.vercel.com/image/upload/v1662130559/nextjs/Icon_light_background.png";

async function liveAgent() {
  const [{ createLessonAgent }, { getLessonMemory }, { resolveLessonModel }] =
    await Promise.all([
      import("../lesson-agent"),
      import("../lesson-memory"),
      import("../lesson-shared"),
    ]);
  const model = resolveLessonModel(process.env.LIVE_MODEL_ID);
  const userId = "user_live_test";
  const threadId = `live-${Date.now()}`;
  const memory = getLessonMemory();
  await memory.createThread({ threadId, resourceId: userId });
  const agent = await createLessonAgent({ threadId, userId, model });
  return {
    agent,
    memory,
    model,
    threadId,
    userId,
    memoryOptions: { thread: threadId, resource: userId, options: { generateTitle: false } },
  };
}

describe.skipIf(!enabled)("lesson agent (live)", () => {
  it("streams a reply from the configured model and persists it", async () => {
    const { agent, memory, model, threadId, userId, memoryOptions } = await liveAgent();
    const stream = await agent.stream("Say hello in one short sentence.", { memory: memoryOptions });
    const text = await stream.text;
    console.log(`[live] ${model} →`, JSON.stringify(text));
    expect(text.trim().length).toBeGreaterThan(0);

    const { messages } = await memory.recall({ threadId, resourceId: userId, perPage: false });
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    await memory.deleteThread(threadId);
  }, 90_000);

  // Guards the attachment path end to end: a UIMessage with file parts by URL,
  // handed to Mastra as-is (exactly what the chat route does), must reach the
  // model with its bytes intact. This is the test that catches an ai/Mastra
  // file-part shape drift — the bug it was written for sent empty files.
  it("reads a PDF and an image attached by URL", async () => {
    const { agent, memory, model, threadId, memoryOptions } = await liveAgent();
    const message: UIMessage = {
      id: "live-attachment",
      role: "user",
      parts: [
        {
          type: "text",
          text: "Do NOT use any tools. In one sentence each: what text is in the PDF, and what does the image show?",
        },
        { type: "file", mediaType: "application/pdf", filename: "dummy.pdf", url: PDF_URL },
        { type: "file", mediaType: "image/png", filename: "icon.png", url: IMAGE_URL },
      ],
    };
    const stream = await agent.stream([message], { memory: memoryOptions, maxSteps: 1 });
    const text = await stream.text;
    console.log(`[live] ${model} attachments →`, JSON.stringify(text));
    expect(text.toLowerCase()).toContain("dummy");
    await memory.deleteThread(threadId);
  }, 120_000);
});
