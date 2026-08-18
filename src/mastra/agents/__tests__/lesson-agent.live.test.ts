/**
 * Live smoke test: real AI Gateway model + real Postgres through the factory.
 * Run: LIVE_MODEL=1 AI_GATEWAY_API_KEY=... DATABASE_URL=... npx vitest run lesson-agent.live
 * Optionally LIVE_MODEL_ID=vercel/xai/grok-4.6 to target one model.
 */
import { describe, expect, it } from "vitest";

const enabled = !!process.env.LIVE_MODEL && !!process.env.AI_GATEWAY_API_KEY && !!process.env.DATABASE_URL;

describe.skipIf(!enabled)("lesson agent (live)", () => {
  it("streams a reply from the configured model and persists it", async () => {
    const [{ createLessonAgent }, { getLessonMemory }, { resolveLessonModel }] =
      await Promise.all([
        import("../lesson-agent"),
        import("../lesson-memory"),
        import("../lesson-shared"),
      ]);
    const model = resolveLessonModel(process.env.LIVE_MODEL_ID);
    const userId = "user_live_test";
    const threadId = `live-${Date.now()}`;
    await getLessonMemory().createThread({ threadId, resourceId: userId });

    const agent = await createLessonAgent({ threadId, userId, model });
    const stream = await agent.stream(
      "Say hello in one short sentence.",
      { memory: { thread: threadId, resource: userId, options: { generateTitle: false } } },
    );
    const text = await stream.text;
    console.log(`[live] ${model} →`, JSON.stringify(text));
    expect(text.trim().length).toBeGreaterThan(0);

    const { messages } = await getLessonMemory().recall({ threadId, resourceId: userId, perPage: false });
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    await getLessonMemory().deleteThread(threadId);
  }, 90_000);
});
