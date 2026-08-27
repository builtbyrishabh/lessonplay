/**
 * Everything that goes INTO the base snapshot. Identical for every thread, so
 * none of it belongs on the request path — `scripts/build-snapshot.ts` runs
 * these once against a builder sandbox and freezes the result.
 */
import type { Sandbox } from "@daytonaio/sdk";
import fs from "node:fs";
import path from "node:path";

import { ENGINE_ROOT } from "~/lib/sandbox-paths";
import { runCommand } from "./daytona";

const ENGINE_SOURCE = path.resolve(process.cwd(), "game-engine");

const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

/** Recursively list files under `dir`, skipping build output and deps. */
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name === ".DS_Store") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** Mirror a local directory into the sandbox at `remoteRoot` (replace-all). */
async function uploadTree(
  sandbox: Sandbox,
  localRoot: string,
  remoteRoot: string,
): Promise<number> {
  if (!fs.existsSync(localRoot)) {
    throw new Error(`[LessonPlay] source missing: ${localRoot}`);
  }
  const files = walkFiles(localRoot);
  const toRemote = (file: string) =>
    path.posix.join(
      remoteRoot,
      path.relative(localRoot, file).split(path.sep).join("/"),
    );

  const remoteDirs = new Set(files.map((f) => path.posix.dirname(toRemote(f))));
  await runCommand(
    sandbox,
    `rm -rf ${remoteRoot} && mkdir -p ${[remoteRoot, ...remoteDirs].join(" ")}`,
  );
  await sandbox.fs.uploadFiles(
    files.map((file) => ({
      source: fs.readFileSync(file),
      destination: toRemote(file),
    })),
  );
  return files.length;
}

/** Copy ./game-engine → ~/engine and install its deps there. */
export async function installEngine(
  sandbox: Sandbox,
  log: (event: string, data?: Record<string, unknown>) => void = () => {},
): Promise<void> {
  const t0 = performance.now();
  const count = await uploadTree(sandbox, ENGINE_SOURCE, ENGINE_ROOT);
  log("sandbox.engine.uploaded", { files: count });

  const install = await runCommand(sandbox, "npm ci --no-audit --no-fund", {
    cwd: ENGINE_ROOT,
    timeoutSeconds: 600,
  });
  if (!install.success) {
    throw new Error(
      `[LessonPlay] engine npm ci failed (exit ${install.exitCode}): ${install.stdout.slice(-2000)}`,
    );
  }
  log("sandbox.engine.ready", {
    durationMs: Math.round(performance.now() - t0),
  });
}

/**
 * Pre-install s3fs so the per-request R2 mount never has to apt-get. The mount
 * script's `which s3fs || apt-get install` guard then short-circuits; the
 * /dev/fuse setup still runs at runtime because device nodes are recreated on
 * every sandbox boot and cannot be baked into an image.
 */
export async function installS3fs(
  sandbox: Sandbox,
  log: (event: string, data?: Record<string, unknown>) => void = () => {},
): Promise<void> {
  const res = await runCommand(
    sandbox,
    "sudo apt-get update -qq && sudo apt-get install -y -qq s3fs && s3fs --version | head -1",
    { timeoutSeconds: 300 },
  );
  if (!res.success) {
    throw new Error(
      `[LessonPlay] s3fs install failed (exit ${res.exitCode}): ${res.stdout.slice(-2000)}`,
    );
  }
  log("sandbox.s3fs.ready", { version: res.stdout.trim().split("\n").pop() });
}
