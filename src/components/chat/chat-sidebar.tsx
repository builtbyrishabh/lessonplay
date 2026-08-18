"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from "next/navigation";

import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

import { NewChatButton } from "./new-chat-button";

export function ChatSidebar() {
  const params = useParams<{ threadId?: string }>();
  const [threads] = api.chats.list.useSuspenseQuery();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r">
      <div className="flex items-center justify-between p-3">
        <Link href="/chats" className="font-semibold">
          LessonPlay
        </Link>
        <UserButton />
      </div>
      <div className="px-3 pb-3">
        <NewChatButton />
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {threads.length === 0 ? (
          <p className="text-muted-foreground px-2 py-4 text-sm">
            No chats yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/chats/${t.id}`}
                  className={cn(
                    "hover:bg-accent block truncate rounded-md px-2 py-1.5 text-sm",
                    params.threadId === t.id && "bg-accent font-medium",
                  )}
                >
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
