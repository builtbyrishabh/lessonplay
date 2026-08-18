"use client";

import { SidebarToggleButton } from "~/components/layout/app-shell";

export function ChatHeader({ title }: { title: string }) {
  return (
    <header className="border-border flex h-12 shrink-0 items-center border-b">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <SidebarToggleButton />
        <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
          {title}
        </span>
      </div>
      {/* Right side (preview / code toggle) arrives with the game preview slice. */}
    </header>
  );
}
