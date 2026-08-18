import { Suspense } from "react";

import { ChatSidebar } from "~/components/chat/chat-sidebar";
import { api, HydrateClient } from "~/trpc/server";

// Thread list depends on the signed-in user; never prerender.
export const dynamic = "force-dynamic";

export default function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  void api.chats.list.prefetch();
  return (
    <HydrateClient>
      <div className="flex h-dvh">
        <Suspense fallback={<aside className="w-64 shrink-0 border-r" />}>
          <ChatSidebar />
        </Suspense>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </HydrateClient>
  );
}
