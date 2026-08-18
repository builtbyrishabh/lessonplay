import { AppShell } from "~/components/layout/app-shell";
import { api, HydrateClient } from "~/trpc/server";

// Everything under the shell depends on the signed-in user; never prerender.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  void api.chats.list.prefetch();
  return (
    <HydrateClient>
      <AppShell>{children}</AppShell>
    </HydrateClient>
  );
}
