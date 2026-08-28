import type { Sandbox } from "@daytonaio/sdk";
import { describe, expect, it } from "vitest";

import {
  expandSandboxPath,
  GAME_ROOT,
  R2_CURRENT_DIR,
  R2_VERSIONS_DIR,
} from "~/lib/sandbox-paths";
import { createSandboxTools } from "..";

/**
 * A fake sandbox: an in-memory file map plus a command log. Enough surface for
 * the four tools, so they can be exercised without Daytona.
 */
function fakeSandbox(
  files: Record<string, string | Buffer> = {},
  /** Canned replies, matched on a substring of the command. */
  replies: { match: string; exitCode: number; result: string }[] = [],
) {
  const store = new Map<string, Buffer>(
    Object.entries(files).map(([k, v]) => [
      k,
      typeof v === "string" ? Buffer.from(v) : v,
    ]),
  );
  const commands: string[] = [];
  const dirs = new Set<string>();

  const sandbox = {
    commands,
    store,
    process: {
      executeCommand: (command: string) => {
        commands.push(command);
        const canned = replies.find((r) => command.includes(r.match));
        return Promise.resolve(
          canned ?? { exitCode: 0, result: `ran: ${command}` },
        );
      },
    },
    fs: {
      getFileDetails: (path: string) => {
        if (dirs.has(path)) return Promise.resolve({ isDir: true, size: 0 });
        const buf = store.get(path);
        if (!buf) return Promise.reject(new Error("no such file"));
        return Promise.resolve({ isDir: false, size: buf.byteLength });
      },
      listFiles: (path: string) =>
        Promise.resolve(
          [...store.keys()]
            .filter((p) => p.startsWith(`${path}/`))
            .map((p) => ({
              name: p.slice(path.length + 1),
              isDir: false,
              size: store.get(p)!.byteLength,
            })),
        ),
      downloadFile: (path: string) => Promise.resolve(store.get(path)!),
      uploadFile: (buffer: Buffer, path: string) => {
        store.set(path, buffer);
        return Promise.resolve();
      },
    },
    markDir: (path: string) => dirs.add(path),
  };
  return sandbox as typeof sandbox & Sandbox;
}

function toolsFor(sandbox: ReturnType<typeof fakeSandbox>) {
  return createSandboxTools({ sandboxPromise: Promise.resolve(sandbox) });
}

// Mastra's createTool wraps execute; call it the way the agent does.
type Executable = { execute: (input: never) => Promise<never> };
const run = <T>(tool: unknown, input: unknown): Promise<T> =>
  (tool as Executable).execute(input as never) as Promise<T>;

describe("expandSandboxPath", () => {
  it("resolves ~, absolute and game-relative paths", () => {
    expect(expandSandboxPath("~/engine/x")).toBe("/home/daytona/engine/x");
    expect(expandSandboxPath("/etc/hosts")).toBe("/etc/hosts");
    expect(expandSandboxPath("src/a.ts")).toBe(`${GAME_ROOT}/src/a.ts`);
    expect(expandSandboxPath("src/../b.ts")).toBe(`${GAME_ROOT}/b.ts`);
  });
});

describe("write", () => {
  it("creates parent directories and writes bytes verbatim", async () => {
    const sandbox = fakeSandbox();
    const res = await run<{ ok: boolean; bytesWritten: number }>(
      toolsFor(sandbox).write,
      { path: "src/scenario.ts", content: "const a = `${x}` // $HOME\n" },
    );

    expect(res.ok).toBe(true);
    expect(sandbox.commands[0]).toBe(`mkdir -p '${GAME_ROOT}/src'`);
    // The shell never sees the content, so nothing is interpolated.
    expect(sandbox.store.get(`${GAME_ROOT}/src/scenario.ts`)?.toString()).toBe(
      "const a = `${x}` // $HOME\n",
    );
    expect(res.bytesWritten).toBe(26);
  });
});

describe("edit", () => {
  const path = `${GAME_ROOT}/src/a.ts`;

  it("replaces a unique match", async () => {
    const sandbox = fakeSandbox({ [path]: "let a = 1;\nlet b = 2;\n" });
    const res = await run<{ ok: boolean; replacements: number }>(
      toolsFor(sandbox).edit,
      { path: "src/a.ts", old_string: "let b = 2;", new_string: "let b = 3;" },
    );

    expect(res).toMatchObject({ ok: true, replacements: 1 });
    expect(sandbox.store.get(path)?.toString()).toBe(
      "let a = 1;\nlet b = 3;\n",
    );
  });

  it("refuses an ambiguous match instead of guessing", async () => {
    const sandbox = fakeSandbox({ [path]: "x\nx\n" });
    const res = await run<{ ok: boolean; error: string }>(
      toolsFor(sandbox).edit,
      { path: "src/a.ts", old_string: "x", new_string: "y" },
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("matches 2 times");
    expect(sandbox.store.get(path)?.toString()).toBe("x\nx\n");
  });

  it("points at write when the file does not exist", async () => {
    const res = await run<{ ok: boolean; error: string }>(
      toolsFor(fakeSandbox()).edit,
      { path: "nope.ts", old_string: "a", new_string: "b" },
    );
    expect(res).toMatchObject({ ok: false });
    expect(res.error).toContain("use write to create it");
  });
});

describe("read", () => {
  it("reads a slice of a text file", async () => {
    const sandbox = fakeSandbox({ [`${GAME_ROOT}/a.txt`]: "l1\nl2\nl3\nl4\n" });
    const res = await run<{ ok: boolean; content: string }>(
      toolsFor(sandbox).read,
      { path: "a.txt", offset: 2, limit: 2 },
    );
    expect(res).toMatchObject({ ok: true, content: "l2\nl3" });
  });

  it("declines binary files rather than dumping them", async () => {
    const sandbox = fakeSandbox({
      [`${GAME_ROOT}/logo.png`]: Buffer.from([0x89, 0x50, 0x00, 0x01]),
    });
    const res = await run<{ ok: boolean; error: string }>(
      toolsFor(sandbox).read,
      { path: "logo.png" },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain("binary");
  });
});

describe("bash", () => {
  it("runs in the game dir and returns the output", async () => {
    const sandbox = fakeSandbox();
    const res = await run<{ output: string; exitCode: number }>(
      toolsFor(sandbox).bash,
      { intent: "Listing the project", command: "ls -la" },
    );
    expect(res).toMatchObject({ exitCode: 0, output: "ran: ls -la" });
  });

  it("reports an unreachable sandbox instead of throwing", async () => {
    const tools = createSandboxTools({
      sandboxPromise: Promise.reject(new Error("boot failed")),
    });
    const res = await run<{ exitCode: number; error: string }>(tools.bash, {
      intent: "Listing the project",
      command: "ls",
    });
    expect(res.exitCode).toBe(-1);
    expect(res.error).toContain("boot failed");
  });
});

describe("publish", () => {
  const GATE = "npm test";
  type PublishResult = {
    ok: boolean;
    version: number | null;
    url: string | null;
    message: string;
  };

  it("refuses to publish when the gate fails, and hands back the output", async () => {
    const sandbox = fakeSandbox({}, [
      { match: GATE, exitCode: 1, result: "FAIL tests/lab.test.ts" },
    ]);
    const res = await run<PublishResult>(toolsFor(sandbox).publish, {
      intent: "Publishing the titration lab",
    });

    expect(res.ok).toBe(false);
    expect(res.version).toBeNull();
    expect(res.message).toContain("FAIL tests/lab.test.ts");
    // Nothing may reach the mount once the gate has said no.
    expect(sandbox.commands.some((c) => c.includes(R2_CURRENT_DIR))).toBe(
      false,
    );
  });

  it("publishes after the gate passes and reports the stable URL", async () => {
    const sandbox = fakeSandbox({}, [
      { match: "PUBLISHED", exitCode: 0, result: "PUBLISHED 3" },
    ]);
    const tools = createSandboxTools({
      sandboxPromise: Promise.resolve(sandbox),
      publishedUrl: "https://games.example.com/games/u1/t1/current/index.html",
    });
    const res = await run<PublishResult>(tools.publish, {
      intent: "Publishing the titration lab",
    });

    expect(res).toMatchObject({
      ok: true,
      version: 3,
      url: "https://games.example.com/games/u1/t1/current/index.html",
    });

    const script = sandbox.commands.find((c) => c.includes(R2_VERSIONS_DIR))!;
    // The snapshot has to land before the live file, so a transfer that dies
    // partway leaves the previously published game serving.
    expect(script.indexOf(R2_VERSIONS_DIR)).toBeLessThan(
      script.indexOf(`${R2_CURRENT_DIR}/index.html`),
    );
    expect(script).toContain("--exclude=./node_modules");
    expect(script).toContain(".tar.gz");
  });

  it("keeps each version's build so an old version stays previewable", async () => {
    const sandbox = fakeSandbox({}, [
      { match: "PUBLISHED", exitCode: 0, result: "PUBLISHED 3" },
    ]);
    await run<PublishResult>(toolsFor(sandbox).publish, {
      intent: "Publishing the titration lab",
    });

    const script = sandbox.commands.find((c) => c.includes(R2_VERSIONS_DIR))!;
    // current/index.html is overwritten every publish; without this copy the
    // only way back to version 3 would be rebuilding its tarball.
    expect(script).toContain(`${R2_VERSIONS_DIR}/"$next".html`);
    // And it still lands before the live file, like the snapshot does.
    expect(script.indexOf(`${R2_VERSIONS_DIR}/"$next".html`)).toBeLessThan(
      script.indexOf(`${R2_CURRENT_DIR}/index.html`),
    );
  });

  it("indexes the published version for the app", async () => {
    const sandbox = fakeSandbox({}, [
      { match: "PUBLISHED", exitCode: 0, result: "PUBLISHED 3" },
    ]);
    const recorded: { version: number; label: string }[] = [];
    const tools = createSandboxTools({
      sandboxPromise: Promise.resolve(sandbox),
      recordVersion: (published) => {
        recorded.push(published);
        return Promise.resolve();
      },
    });

    const res = await run<PublishResult>(tools.publish, {
      intent: "Publishing the titration lab",
    });

    expect(res.ok).toBe(true);
    // The teacher-facing intent doubles as the version's label.
    expect(recorded).toEqual([
      { version: 3, label: "Publishing the titration lab" },
    ]);
  });

  it("still reports success when indexing the version fails", async () => {
    const sandbox = fakeSandbox({}, [
      { match: "PUBLISHED", exitCode: 0, result: "PUBLISHED 3" },
    ]);
    const tools = createSandboxTools({
      sandboxPromise: Promise.resolve(sandbox),
      recordVersion: () => Promise.reject(new Error("database is down")),
    });

    const res = await run<PublishResult>(tools.publish, {
      intent: "Publishing the titration lab",
    });

    // The game IS in the bucket at this point. Reporting a failure would send
    // the model back through the whole gate to fix something it cannot reach.
    expect(res).toMatchObject({ ok: true, version: 3 });
    expect(res.message).not.toContain("database is down");
  });

  it("does not index a publish whose version could not be read", async () => {
    const sandbox = fakeSandbox({}, [
      { match: "PUBLISHED", exitCode: 0, result: "PUBLISHED not-a-number" },
    ]);
    const recorded: unknown[] = [];
    const tools = createSandboxTools({
      sandboxPromise: Promise.resolve(sandbox),
      recordVersion: (published) => {
        recorded.push(published);
        return Promise.resolve();
      },
    });

    await run<PublishResult>(tools.publish, {
      intent: "Publishing the titration lab",
    });

    // A NaN version would violate the table's primary key.
    expect(recorded).toEqual([]);
  });

  it("explains a multi-file dist instead of publishing half a game", async () => {
    const sandbox = fakeSandbox({}, [
      {
        match: "NOT_SELF_CONTAINED",
        exitCode: 4,
        result: "NOT_SELF_CONTAINED\n/home/daytona/game/dist/assets/app.js",
      },
    ]);
    const res = await run<PublishResult>(toolsFor(sandbox).publish, {
      intent: "Publishing the titration lab",
    });

    expect(res.ok).toBe(false);
    expect(res.message).toContain("vite-plugin-singlefile");
  });

  it("reports an unreachable sandbox instead of throwing", async () => {
    const tools = createSandboxTools({
      sandboxPromise: Promise.reject(new Error("boot failed")),
    });
    const res = await run<PublishResult>(tools.publish, {
      intent: "Publishing the titration lab",
    });
    expect(res.ok).toBe(false);
    expect(res.message).toContain("boot failed");
  });
});

describe("validate", () => {
  const VALIDATOR = "bin/validate.ts";
  type ValidateResult = {
    ok: boolean;
    errors: string[];
    levels?: { levelId: string; railed: boolean; toolsNeeded: number | null }[];
    message: string;
  };

  const report = (body: Record<string, unknown>) => JSON.stringify(body);

  it("reports a clean game as safe to publish", async () => {
    const sandbox = fakeSandbox({}, [
      {
        match: VALIDATOR,
        exitCode: 0,
        result: report({ ok: true, items: [], errors: [] }),
      },
    ]);
    const res = await run<ValidateResult>(toolsFor(sandbox).validate, {
      intent: "Checking the mixtures game",
    });

    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.message).toContain("plays through to a win");
  });

  it("hands back the errors and the per-level analysis when the game fails", async () => {
    const sandbox = fakeSandbox({}, [
      {
        match: VALIDATOR,
        exitCode: 1,
        result: report({
          ok: false,
          errors: ['level "one" is railed'],
          items: [
            {
              levels: [
                {
                  levelId: "one",
                  goalKind: "classify",
                  winnable: true,
                  bruteForceable: false,
                  railed: true,
                  toolsNeeded: 1,
                  indistinguishablePairs: [],
                },
              ],
            },
          ],
        }),
      },
    ]);
    const res = await run<ValidateResult>(toolsFor(sandbox).validate, {
      intent: "Checking the mixtures game",
    });

    expect(res.ok).toBe(false);
    expect(res.errors).toEqual(['level "one" is railed']);
    // The quality signal is the point: it tells the model what to redesign.
    expect(res.levels).toMatchObject([{ levelId: "one", railed: true, toolsNeeded: 1 }]);
  });

  it("treats a game it could not find as a failure, never a pass", async () => {
    const sandbox = fakeSandbox({}, [
      {
        match: VALIDATOR,
        exitCode: 2,
        result: report({
          ok: false,
          error: "package.json has no `lessonplay` field",
          hint: "Add the field.",
        }),
      },
    ]);
    const res = await run<ValidateResult>(toolsFor(sandbox).validate, {
      intent: "Checking the mixtures game",
    });

    expect(res.ok).toBe(false);
    expect(res.message).toContain("lessonplay");
    expect(res.message).toContain("do not treat this as a pass");
  });

  it("does not claim success when the validator returns nothing readable", async () => {
    const sandbox = fakeSandbox({}, [
      { match: VALIDATOR, exitCode: 0, result: "tsx: command not found" },
    ]);
    const res = await run<ValidateResult>(toolsFor(sandbox).validate, {
      intent: "Checking the mixtures game",
    });

    expect(res.ok).toBe(false);
    expect(res.message).toContain("command not found");
  });
});

describe("publish — validation gate", () => {
  const VALIDATOR = "bin/validate.ts";
  type PublishResult = { ok: boolean; message: string };

  it("refuses to publish a game that fails validation, without building", async () => {
    const sandbox = fakeSandbox({}, [
      {
        match: VALIDATOR,
        exitCode: 1,
        result: JSON.stringify({
          ok: false,
          errors: ['level "two" is not completable'],
        }),
      },
    ]);
    const res = await run<PublishResult>(toolsFor(sandbox).publish, {
      intent: "Publishing the mixtures game",
    });

    expect(res.ok).toBe(false);
    expect(res.message).toContain("not completable");
    // The expensive gate must not run once validation has said no, and nothing
    // may reach the mount.
    expect(sandbox.commands.some((c) => c.includes("npm test"))).toBe(false);
    expect(sandbox.commands.some((c) => c.includes(R2_CURRENT_DIR))).toBe(false);
  });

  it("refuses to publish when the validator cannot find the game at all", async () => {
    const sandbox = fakeSandbox({}, [
      {
        match: VALIDATOR,
        exitCode: 2,
        result: JSON.stringify({ ok: false, error: "no lessonplay field" }),
      },
    ]);
    const res = await run<PublishResult>(toolsFor(sandbox).publish, {
      intent: "Publishing the mixtures game",
    });

    expect(res.ok).toBe(false);
    expect(res.message).toContain("could not find this game's data");
    expect(sandbox.commands.some((c) => c.includes("npm test"))).toBe(false);
  });

  it("validates before it tests and builds", async () => {
    const sandbox = fakeSandbox({}, [
      { match: "PUBLISHED", exitCode: 0, result: "PUBLISHED 1" },
    ]);
    await run<PublishResult>(toolsFor(sandbox).publish, {
      intent: "Publishing the mixtures game",
    });

    const validatedAt = sandbox.commands.findIndex((c) => c.includes(VALIDATOR));
    const gatedAt = sandbox.commands.findIndex((c) => c.includes("npm test"));
    expect(validatedAt).toBeGreaterThanOrEqual(0);
    // Seconds before minutes: an unfinishable game should not wait on a build.
    expect(validatedAt).toBeLessThan(gatedAt);
  });
});
