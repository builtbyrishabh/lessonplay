import { auth } from "@clerk/nextjs/server";
import { toAISdkStream } from "@mastra/ai-sdk";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

import { isValidThreadId } from "~/lib/thread-id";
import { createLessonAgent } from "~/mastra/agents/lesson-agent";
import {
  LESSON_MAX_STEPS,
  LESSON_MODEL_SETTINGS,
  resolveLessonModel,
} from "~/mastra/agents/lesson-shared";

export const maxDuration = 300;

type ChatRequestBody = {
  messages: UIMessage[];
  threadId: string;
  model?: unknown;
};

/**
 * Streaming bridge: AI SDK UIMessages in → Mastra agent → UIMessage stream out.
 * Protocol translation only; agent assembly lives in the factory.
 */
export async function POST(req: Request) {
  const requestStartedAt = performance.now();
  const traceId = crypto.randomUUID().slice(0, 8);
  const log = (event: string, data: Record<string, unknown> = {}) => {
    console.log(`[lesson-chat:${traceId}] ${event}`, {
      elapsedMs: Math.round(performance.now() - requestStartedAt),
      ...data,
    });
  };

  const session = await auth();
  if (!session.userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.userId;

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { messages, threadId } = body;
  if (!isValidThreadId(threadId)) {
    return new Response("threadId is invalid", { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages are required", { status: 400 });
  }

  const model = resolveLessonModel(body.model);
  log("request.parsed", { threadId, model, messageCount: messages.length });

  const [agent, modelMessages] = await Promise.all([
    createLessonAgent({ threadId, userId, model, trace: { id: traceId, log } }),
    convertToModelMessages(messages),
  ]);

  const streamStartedAt = performance.now();
  const stream = await agent.stream(modelMessages, {
    modelSettings: LESSON_MODEL_SETTINGS,
    maxSteps: LESSON_MAX_STEPS,
    memory: { thread: threadId, resource: userId },
    savePerStep: true,
    onStepFinish: (event) => {
      log("agent.step.finish", {
        finishReason: event.finishReason,
        toolCalls: event.toolCalls?.length ?? 0,
        usage: event.usage,
      });
    },
    onFinish: (event) => {
      log("agent.stream.finish", {
        durationMs: Math.round(performance.now() - streamStartedAt),
        finishReason: event.finishReason,
        usage: event.usage,
      });
    },
  });

  const uiMessageStream = createUIMessageStream({
    originalMessages: messages,
    onError: (error) => {
      log("ui_stream.error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return error instanceof Error ? error.message : "Something went wrong";
    },
    execute: async ({ writer }) => {
      writer.merge(
        toAISdkStream(stream, {
          from: "agent",
          version: "v6",
          sendReasoning: true,
        }),
      );
    },
  });

  return createUIMessageStreamResponse({ stream: uiMessageStream });
}
