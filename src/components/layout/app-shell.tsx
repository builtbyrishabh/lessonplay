"use client";

import { createContext, useContext, useState } from "react";

import { Sidebar } from "~/components/layout/sidebar";
import { Button } from "~/components/ui/button";
import { SidebarToggleIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";

const SidebarContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

/** Shown only while the sidebar is collapsed. */
export function SidebarToggleButton({ className }: { className?: string }) {
  const sidebar = useContext(SidebarContext);
  if (!sidebar || sidebar.open) return null;

  return (
    <Button
      aria-label="Expand sidebar"
      className={cn("text-muted-foreground size-8 shrink-0", className)}
      onClick={() => sidebar.setOpen(true)}
      size="icon"
      variant="ghost"
    >
      <SidebarToggleIcon size={18} />
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      <div className="bg-background flex h-dvh overflow-hidden">
        <Sidebar onToggle={() => setOpen((o) => !o)} open={open} />
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </SidebarContext.Provider>
  );
}
