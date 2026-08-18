import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { isValidThreadId, newThreadId } from "~/lib/thread-id";
import { getLessonMemory } from "~/mastra/agents/lesson-memory";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const threadIdSchema = z.string().refine(isValidThreadId, "invalid threadId");

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
      title: t.title ?? "New chat",
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }),

  create: protectedProcedure
    .input(z.object({ threadId: threadIdSchema.optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const memory = getLessonMemory();
      const thread = await memory.createThread({
        threadId: input?.threadId ?? newThreadId(),
        resourceId: ctx.userId,
      });
      return { id: thread.id, title: thread.title ?? "New chat" };
    }),

  messages: protectedProcedure
    .input(z.object({ threadId: threadIdSchema }))
    .query(async ({ ctx, input }) => {
      const memory = getLessonMemory();
      const thread = await memory.getThreadById({ threadId: input.threadId });
      if (!thread || thread.resourceId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const { messages } = await memory.recall({
        threadId: input.threadId,
        resourceId: ctx.userId,
        perPage: false,
      });
      return {
        thread: { id: thread.id, title: thread.title ?? "New chat" },
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
