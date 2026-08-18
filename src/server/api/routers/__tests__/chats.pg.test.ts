/**
 * Integration test against a real Postgres (the same path the app uses).
 * Run: PG_INTEGRATION=1 DATABASE_URL=postgresql://... npx vitest run chats.pg
 */
import { describe, expect, it } from "vitest";

import { chatsRouter } from "../chats";
import { createCallerFactory } from "../../trpc";

const enabled = !!process.env.PG_INTEGRATION && !!process.env.DATABASE_URL;

describe.skipIf(!enabled)("chats router (postgres)", () => {
  const createCaller = createCallerFactory(chatsRouter);
  const userId = `user_pg_${Date.now()}`;
  const otherUserId = `user_pg_other_${Date.now()}`;
  const ctx = (uid: string) =>
    ({ db: null as never, userId: uid, headers: new Headers() }) as never;

  it("create → list → messages → delete, scoped to the owner", async () => {
    const mine = createCaller(ctx(userId));
    const theirs = createCaller(ctx(otherUserId));

    const created = await mine.create();
    expect(created.id).toMatch(/^[A-Za-z0-9_-]{8,128}$/);

    const list = await mine.list();
    expect(list.map((t) => t.id)).toContain(created.id);
    expect((await theirs.list()).map((t) => t.id)).not.toContain(created.id);

    const detail = await mine.messages({ threadId: created.id });
    expect(detail.thread.id).toBe(created.id);
    expect(detail.messages).toEqual([]);

    await expect(theirs.messages({ threadId: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(theirs.delete({ threadId: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await mine.delete({ threadId: created.id });
    expect((await mine.list()).map((t) => t.id)).not.toContain(created.id);
  });
});
