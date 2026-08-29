import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { isValidThreadId } from "~/lib/thread-id";
import { getLessonMemory } from "~/mastra/agents/lesson-memory";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const threadIdSchema = z.string().refine(isValidThreadId, "invalid threadId");

/**
 * Mastra stores a brand-new thread's title as `""` (not null) and only fills it
 * in when the auto-title runs at the end of the first turn. `?? "New chat"` did
 * not catch that, so a new chat rendered as a blank row in the sidebar and only
 * *appeared* once the first reply finished. Treat empty/whitespace as untitled.
 */
function threadTitle(title: string | null | undefined) {
  return title?.trim() || "New chat";
}

/** Thread CRUD over Mastra Memory. Streaming lives in /api/chat (route handler). */
export const chatsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memory = getLessonMemory();
    const { threads } = await memory.listThreads({
      filter: { resourceId: ctx.userId },
      orderBy: { field: "updatedAt", direction: "DESC" },
      perPage: 100,
    });
    return threads.map((t) => ({
      id: t.id,
      title: threadTitle(t.title),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }),

  create: protectedProcedure
    .input(z.object({ threadId: threadIdSchema }))
    .mutation(async ({ ctx, input }) => {
      const memory = getLessonMemory();
      const thread = await memory.createThread({
        threadId: input.threadId,
        resourceId: ctx.userId,
      });
      return { id: thread.id, title: threadTitle(thread.title) };
    }),

  messages: protectedProcedure
    .input(z.object({ threadId: threadIdSchema }))
    .query(async ({ ctx, input }) => {
      const memory = getLessonMemory();
      const thread = await memory.getThreadById({ threadId: input.threadId });
      // A thread that exists but belongs to someone else is a hard 404.
      if (thread && thread.resourceId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      // A thread that does not exist YET is the normal case now that the home
      // page skips `chats.create`: Mastra upserts it on the first message. Serve
      // an empty conversation so navigating to it renders instead of 404-ing.
      if (!thread) {
        return {
          thread: { id: input.threadId, title: threadTitle(null) },
          messages: [],
        };
      }
      const { messages } = await memory.recall({
        threadId: input.threadId,
        resourceId: ctx.userId,
        perPage: false,
      });
      return {
        thread: { id: thread.id, title: threadTitle(thread.title) },
        messages: toAISdkMessages(messages, { version: "v6" }),
      };
    }),

  rename: protectedProcedure
    .input(
      z.object({ threadId: threadIdSchema, title: z.string().trim().min(1).max(200) }),
    )
    .mutation(async ({ ctx, input }) => {
      const memory = getLessonMemory();
      const thread = await memory.getThreadById({ threadId: input.threadId });
      if (!thread || thread.resourceId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await memory.updateThread({ id: input.threadId, title: input.title });
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ threadId: threadIdSchema }))
    .mutation(async ({ ctx, input }) => {
      const memory = getLessonMemory();
      const thread = await memory.getThreadById({ threadId: input.threadId });
      if (!thread || thread.resourceId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await memory.deleteThread(input.threadId);
      return { ok: true };
    }),
});
