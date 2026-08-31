import { auth } from "@clerk/nextjs/server";
import { toAISdkStream } from "@mastra/ai-sdk";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

import { publishedGameKey } from "~/lib/sandbox-paths";
import { isValidThreadId } from "~/lib/thread-id";
import { recordGameVersion } from "~/server/db/games";
import { publicObjectUrl } from "~/server/r2";
import { prepareLessonSandbox } from "~/server/sandbox/prepare";
import { createLessonAgent } from "~/mastra/agents/lesson-agent";
import {
  LESSON_MAX_STEPS,
  LESSON_MODEL_SETTINGS,
  resolveLessonModel,
} from "~/mastra/agents/lesson-shared";

export const maxDuration = 300;

type ChatRequestBody = {
  /** Only the newest user message; history is loaded from Mastra Memory. */
  message: UIMessage;
  threadId: string;
  model?: unknown;
};

/**
 * Streaming bridge: one new UIMessage in → Mastra agent (history from Memory)
 * → UIMessage stream out. Protocol translation only; agent assembly lives in
 * the factory.
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

  const { message, threadId } = body;
  if (!isValidThreadId(threadId)) {
    return new Response("threadId is invalid", { status: 400 });
  }
  if (!message || message.role !== "user" || !Array.isArray(message.parts)) {
    return new Response("a user message is required", { status: 400 });
  }

  const model = resolveLessonModel(body.model);
  log("request.parsed", {
    threadId,
    model,
    attachments: message.parts.filter((p) => p.type === "file").length,
  });

  // Kick the sandbox off first and DO NOT await it — boot, R2 mount and the
  // restore of the last published source all run while the agent is assembled
  // and the model produces its first tokens. The promise is awaited only
  // inside a tool, if the model ever calls one.
  const trace = { id: traceId, log };
  const sandboxPromise = prepareLessonSandbox({ threadId, userId, trace });

  const agent = await createLessonAgent({
    threadId,
    userId,
    model,
    sandboxPromise,
    // Stable for the life of the thread: every publish overwrites this one key,
    // so the teacher's link never changes.
    publishedUrl: publicObjectUrl(publishedGameKey(userId, threadId)),
    // Bound to this thread and user here, so the tool cannot record a version
    // against anyone else's game — the model never supplies either id.
    recordVersion: ({ version, label }) =>
      recordGameVersion({ threadId, userId, version, label }),
    trace,
  });

  // The UIMessage goes to Mastra AS-IS. Mastra reads a file part's `url`
  // directly on this path; running the message through `convertToModelMessages`
  // first (ai@7) would wrap that url in a `{ type: "url", url }` union which
  // Mastra 1.59 does not recognise and persists as `data: ""` — the model then
  // receives an empty file. Attachments are plain URLs the AI Gateway fetches
  // itself (it advertises support for every URL, so nothing downloads here).
  const streamStartedAt = performance.now();
  const stream = await agent.stream([message], {
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
        steps: event.steps.length,
        totalUsage: event.totalUsage,
        runId: event.runId,
      });
    },
  });

  const uiMessageStream = createUIMessageStream({
    originalMessages: [message],
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
