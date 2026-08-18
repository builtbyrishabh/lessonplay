"use client";

import { useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function NewChatButton() {
  const router = useRouter();
  const utils = api.useUtils();
  const create = api.chats.create.useMutation({
    onSuccess: async ({ id }) => {
      await utils.chats.list.invalidate();
      router.push(`/chats/${id}`);
    },
  });

  return (
    <Button
      className="w-full"
      disabled={create.isPending}
      onClick={() => create.mutate()}
    >
      New chat
    </Button>
  );
}
