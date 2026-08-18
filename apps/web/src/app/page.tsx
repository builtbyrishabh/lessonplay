import { UserButton } from "@clerk/nextjs";

import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const me = await api.user.me();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <UserButton />
        <h1 className="text-3xl font-semibold">LessonPlay</h1>
        <p className="text-sm text-neutral-500">
          Signed in as <code>{me.userId}</code>
        </p>
      </main>
    </HydrateClient>
  );
}
