/**
 * Shown while the chat page's server component resolves. Without this file the
 * `router.push` from the home page blocks on the RSC fetch before painting
 * anything, so the new thread felt slow to open. With it, the shell appears
 * instantly and the conversation streams in.
 */
export default function ChatLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border/60 flex h-14 items-center gap-3 border-b px-4">
        <div className="bg-muted h-4 w-40 animate-pulse rounded" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <div className="bg-muted ml-auto h-16 w-2/3 animate-pulse rounded-2xl" />
        <div className="bg-muted/70 h-24 w-3/4 animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
