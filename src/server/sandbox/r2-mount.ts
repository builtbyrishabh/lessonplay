import type { Sandbox } from "@daytonaio/sdk";

import { env } from "~/env";
import { gameBucketPrefix, R2_ROOT } from "~/lib/sandbox-paths";
import { runCommand } from "./daytona";

const LOG_PATH = "/tmp/s3fs-game.log";

function buildMountScript(bucketPrefix: string): string {
  const bucketArg = `${env.R2_BUCKET_NAME}:/${bucketPrefix}`;
  const opts = [
    // s3fs rejects a trailing slash on the endpoint.
    `url=${env.R2_S3_ENDPOINT.replace(/\/+$/, "")}`,
    "endpoint=auto",
    "use_path_request_style",
    "sigv4",
    "compat_dir", // objects written by other clients may lack directory markers
    "dbglevel=info",
    `logfile=${LOG_PATH}`,
    "allow_other",
  ]
    .map((o) => `-o ${o}`)
    .join(" ");

  return [
    // 1. s3fs present
    `which s3fs >/dev/null 2>&1 || (sudo apt-get update -qq && sudo apt-get install -y -qq s3fs >/dev/null 2>&1)`,
    // 2. FUSE device
    `if [ ! -c /dev/fuse ]; then grep -qw fuse /proc/filesystems || { echo "[LessonPlay] FUSE unavailable in this sandbox"; exit 1; }; sudo rm -f /dev/fuse && sudo mknod /dev/fuse c 10 229 && sudo chmod 666 /dev/fuse; fi`,
    `test -r /dev/fuse -a -w /dev/fuse || sudo chmod 666 /dev/fuse`,
    // 2b. allow_other (below) is refused unless fuse.conf opts into it. Without
    // it the mount is visible only to the uid that made it, so anything running
    // as root in ~/game would get EACCES.
    `grep -qxs user_allow_other /etc/fuse.conf || echo user_allow_other | sudo tee -a /etc/fuse.conf >/dev/null`,
    // 3. mountpoint sane
    `mkdir -p ${R2_ROOT}`,
    `if mountpoint -q ${R2_ROOT}; then echo "[LessonPlay] already mounted"; exit 0; fi`,
    `if [ -n "$(find ${R2_ROOT} -mindepth 1 -maxdepth 1 -print -quit)" ]; then echo "[LessonPlay] mountpoint not mounted and non-empty"; exit 1; fi`,
    // 4. mount
    `s3fs ${bucketArg} ${R2_ROOT} ${opts}`,
  ].join(" && ");
}

/**
 * Mount games/<userId>/<threadId> from R2 onto ~/r2. This is the durability
 * boundary only — the agent works on local disk in ~/game and crosses into the
 * mount once, at publish. Idempotent: safe on
 * every request; heals stale mounts by restarting the sandbox.
 */

export async function mountR2Bucket(
  sandbox: Sandbox,
  ids: { userId: string; threadId: string },
  log: (event: string, data?: Record<string, unknown>) => void = () => {},
): Promise<void> {
  const prefix = gameBucketPrefix(ids.userId, ids.threadId);

  // Probe current state.
  const probe = await runCommand(
    sandbox,
    `if grep -qs " ${R2_ROOT} " /proc/mounts; then if timeout 5 stat ${R2_ROOT} >/dev/null 2>&1; then echo MOUNTED_HEALTHY; else echo MOUNTED_STALE; fi; else echo UNMOUNTED; fi`,
  );
  const state = probe.stdout.trim();
  log("sandbox.mount.probe", { state });
  if (state === "MOUNTED_HEALTHY") return;
  if (state === "MOUNTED_STALE") {
    log("sandbox.mount.stale_restart");
    await sandbox.stop();
    await sandbox.start(120);
  }

  // Mount.
  const res = await runCommand(sandbox, buildMountScript(prefix), {
    env: {
      AWS_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    },
    timeoutSeconds: 180,
  });
  if (!res.success) {
    throw new Error(
      `[LessonPlay] R2 mount failed (exit ${res.exitCode}): ${res.stdout || "no output"}`,
    );
  }

  // Wait until the mount is actually live.
  const check = await runCommand(
    sandbox,
    `for i in $(seq 1 10); do if mountpoint -q ${R2_ROOT} && timeout 5 stat ${R2_ROOT} >/dev/null 2>&1; then echo OK; exit 0; fi; sleep 1; done; tail -50 ${LOG_PATH} 2>/dev/null || true; echo NOT_MOUNTED`,
  );
  if (!check.stdout.split("\n").includes("OK")) {
    throw new Error(
      `[LessonPlay] R2 mount not live: ${check.stdout.trim() || R2_ROOT + " is not a mountpoint"}`,
    );
  }
  log("sandbox.mount.ok", { prefix });
}
