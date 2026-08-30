import { redirect } from "next/navigation";

// Old route-segment links funnel into the query-param SPA so shared
// /chats/<id> URLs keep working.
export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  redirect(`/chats?id=${threadId}`);
}
