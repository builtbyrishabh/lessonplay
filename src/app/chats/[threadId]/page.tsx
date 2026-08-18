import { TRPCError } from "@trpc/server";
import { notFound } from "next/navigation";

import { Chat } from "~/components/chat/chat";
import { api } from "~/trpc/server";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;

  let data;
  try {
    data = await api.chats.messages({ threadId });
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  return <Chat threadId={threadId} initialMessages={data.messages} />;
}
