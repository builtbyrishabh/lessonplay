"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { Suspense } from "react";

import { Logo } from "~/components/brand/logo";
import { ChatItem } from "~/components/layout/chat-item";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ChevronDownIcon, SidebarToggleIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type SidebarProps = { open: boolean; onToggle: () => void };

export function Sidebar(props: SidebarProps) {
  // Sidebar and page address the SAME `?id=` param (the nuqs adapter wraps both).
  // Clearing it is a shallow client update — no route navigation, no RSC — so a
  // new chat appears in the same frame instead of waiting behind a router
  // transition (which, mid-stream, was the slow `<Link href="/chats">` path).
  const [, setActiveId] = useQueryState("id");

  return (
    <aside
      className={cn(
        "bg-sidebar flex shrink-0 flex-col gap-1 overflow-hidden transition-[width] duration-200",
        props.open ? "border-sidebar-border w-64 border-r" : "w-0",
      )}
    >
      {props.open ? (
        <div className="flex w-64 flex-1 flex-col gap-1 overflow-y-auto p-2">
          <div className="mb-1 flex items-center gap-1">
            <Link
              className="text-sidebar-foreground flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-sm font-medium"
              href="/chats"
            >
              <Logo />
            </Link>
            <Button
              aria-label="Collapse sidebar"
              className="text-muted-foreground size-8 shrink-0"
              onClick={props.onToggle}
              size="icon"
              variant="ghost"
            >
              <SidebarToggleIcon size={18} />
            </Button>
          </div>

          <button
            className="border-sidebar-border bg-background text-sidebar-foreground hover:bg-accent flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors"
            onClick={() => void setActiveId(null)}
            type="button"
          >
            New Chat
          </button>

          <Collapsible className="mt-4" defaultOpen>
            <CollapsibleTrigger className="group text-muted-foreground flex w-full items-center gap-1 px-2.5 py-1 text-xs font-medium">
              <span className="flex-1 text-left">Recent Chats</span>
              <ChevronDownIcon className="size-3.5 transition-transform group-data-[state=closed]:-rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-0.5">
              <Suspense fallback={<ChatNamesSkeleton />}>
                <ChatList />
              </Suspense>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex-1" />
          <UserFooter />
        </div>
      ) : null}
    </aside>
  );
}

function ChatList() {
  const activeId = useSearchParams().get("id");
  const router = useRouter();
  const [threads] = api.chats.list.useSuspenseQuery();

  if (threads.length === 0) {
    return (
      <p className="text-muted-foreground px-2.5 py-1 text-xs">No chats yet</p>
    );
  }

  return threads.map((thread) => (
    <ChatItem
      isActive={activeId === thread.id}
      key={thread.id}
      onDeleted={(id) => {
        if (activeId === id) router.push("/chats");
      }}
      thread={thread}
    />
  ));
}

function ChatNamesSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div className="animate-pulse px-2.5 py-1.5" key={i}>
          <div className="bg-muted h-3 w-3/4 rounded" />
        </div>
      ))}
    </>
  );
}

function UserFooter() {
  const { user } = useUser();
  return (
    <div className="flex items-center gap-2 px-1.5 py-1">
      <UserButton />
      <span className="text-sidebar-foreground truncate text-sm">
        {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? ""}
      </span>
    </div>
  );
}
