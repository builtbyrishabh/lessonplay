"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { MoreHorizontalIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type Thread = RouterOutputs["chats"]["list"][number];

export function ChatItem({
  thread,
  isActive,
  onDeleted,
}: {
  thread: Thread;
  isActive: boolean;
  onDeleted: (id: string) => void;
}) {
  const utils = api.useUtils();
  const rename = api.chats.rename.useMutation({
    onSuccess: () => utils.chats.list.invalidate(),
  });
  const remove = api.chats.delete.useMutation({
    onSuccess: () => utils.chats.list.invalidate(),
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(thread.title);
  const busy = rename.isPending || remove.isPending;
  const error = rename.error?.message ?? remove.error?.message ?? null;

  const handleRename = async () => {
    const title = renameValue.trim();
    if (!title || title === thread.title) {
      setRenameOpen(false);
      return;
    }
    await rename.mutateAsync({ threadId: thread.id, title });
    setRenameOpen(false);
  };

  const handleDelete = async () => {
    await remove.mutateAsync({ threadId: thread.id });
    onDeleted(thread.id);
    setDeleteOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          "group/item text-sidebar-foreground hover:bg-sidebar-accent relative flex items-center rounded-md text-sm transition-colors",
          (isActive || menuOpen) && "bg-sidebar-accent",
        )}
      >
        <Link
          className={cn(
            "min-w-0 flex-1 truncate py-1.5 pr-7 pl-2.5",
            isActive && "font-medium",
          )}
          href={`/chats?id=${thread.id}`}
        >
          {thread.title}
        </Link>

        <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Chat options"
              className={cn(
                "text-muted-foreground hover:bg-accent absolute right-1 flex size-6 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100",
                menuOpen && "opacity-100",
              )}
              type="button"
            >
              <MoreHorizontalIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44" side="right">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setRenameValue(thread.title);
                setRenameOpen(true);
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setDeleteOpen(true);
              }}
              variant="destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog onOpenChange={setRenameOpen} open={renameOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`rename-${thread.id}`}>New chat title</Label>
            <Input
              autoFocus
              id={`rename-${thread.id}`}
              onChange={(event) => setRenameValue(event.target.value)}
              onFocus={(event) => event.target.select()}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleRename();
              }}
              value={renameValue}
            />
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setRenameOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={busy} onClick={handleRename} type="button">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              This permanently deletes the chat and its messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {error ? (
              <p className="text-destructive mr-auto text-sm">{error}</p>
            ) : null}
            <Button
              onClick={() => setDeleteOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={handleDelete}
              type="button"
              variant="destructive"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
