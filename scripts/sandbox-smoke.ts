/**
 * End-to-end smoke test for the durability boundary: mount → build → publish
 * → hydrate, against a real R2 bucket.
 *
 *   pnpm sandbox:smoke
 *
 * It runs the same `publishScript()` / `hydrateScript()` the agent runs, so a
 * pass means those exact strings work against s3fs — which is the part unit
 * tests cannot prove (tar extraction and `cp -a` into a FUSE mount).
 *
 * Writes under games/smoke-user/smoke-thread/ and deletes the sandbox after.
 */
import "./load-env";

import {
  GAME_ROOT,
  PUBLISHED_FILE,
  R2_CURRENT_DIR,
  R2_VERSIONS_DIR,
} from "../src/lib/sandbox-paths";
import {
  getDaytonaClient,
  getOrCreateSandbox,
  runCommand,
} from "../src/server/sandbox/daytona";
import { mountR2Bucket } from "../src/server/sandbox/r2-mount";
import { hydrateScript, publishScript } from "../src/server/sandbox/scripts";

const IDS = { userId: "smoke-user", threadId: "smoke-thread" };
const MARKER = `smoke-${Date.now()}`;

const t0 = performance.now();
const log = (event: string, data?: unknown) =>
  console.log(`[${Math.round(performance.now() - t0)}ms] ${event}`, data ?? "");

function assert(ok: boolean, what: string, detail?: unknown) {
  if (!ok) {
    console.error(`FAIL: ${what}`, detail ?? "");
    process.exitCode = 1;
    throw new Error(what);
  }
  log(`ok: ${what}`);
}

const { sandbox, status } = await getOrCreateSandbox("lessonplay-smoke", {});
log("sandbox", { status, id: sandbox.id });

try {
  await mountR2Bucket(sandbox, IDS, log);

  // Start from a clean slate so version numbers are predictable.
  await runCommand(
    sandbox,
    `rm -rf ${R2_VERSIONS_DIR} ${R2_CURRENT_DIR} ${GAME_ROOT}`,
    { timeoutSeconds: 120 },
  );

  // 1. A hydrate with nothing published yet must be a quiet no-op.
  const fresh = await runCommand(sandbox, hydrateScript());
  assert(
    fresh.success && fresh.stdout.includes("FRESH"),
    "hydrate on a never-published thread is a no-op",
    fresh,
  );

  // 2. Stand in for a built game: source, node_modules that must NOT ship,
  //    and a single self-contained dist/index.html.
  await runCommand(
    sandbox,
    [
      `mkdir -p ${GAME_ROOT}/src ${GAME_ROOT}/node_modules/junk ${GAME_ROOT}/dist`,
      `printf 'export const marker = "${MARKER}";\\n' > ${GAME_ROOT}/src/scenario.ts`,
      `printf '{"name":"smoke"}' > ${GAME_ROOT}/package.json`,
      `head -c 200000 /dev/zero > ${GAME_ROOT}/node_modules/junk/big.bin`,
      `printf '<html><body>${MARKER}</body></html>' > ${GAME_ROOT}/dist/${PUBLISHED_FILE}`,
    ].join(" && "),
  );

  // 3. Publish twice — the second must land as version 2, not overwrite 1.
  const first = await runCommand(sandbox, publishScript(), {
    timeoutSeconds: 180,
  });
  assert(
    first.success && first.stdout.trim().endsWith("PUBLISHED 1"),
    "first publish is version 1",
    first,
  );

  const second = await runCommand(sandbox, publishScript(), {
    timeoutSeconds: 180,
  });
  assert(
    second.success && second.stdout.trim().endsWith("PUBLISHED 2"),
    "second publish increments to version 2",
    second,
  );

  // 4. What actually landed in the bucket.
  const landed = await runCommand(
    sandbox,
    [
      `cat ${R2_CURRENT_DIR}/${PUBLISHED_FILE}`,
      `echo "---"`,
      `ls -1 ${R2_VERSIONS_DIR}`,
      `echo "---"`,
      `tar -tzf ${R2_VERSIONS_DIR}/2.tar.gz | sort`,
    ].join(" && "),
    { timeoutSeconds: 120 },
  );
  log("landed", landed.stdout);
  assert(landed.stdout.includes(MARKER), "published HTML has this run's bytes");
  assert(
    landed.stdout.includes("scenario.ts") &&
      landed.stdout.includes("package.json"),
    "source snapshot carries the project files",
  );
  assert(
    landed.stdout.includes("1.tar.gz") && landed.stdout.includes("2.tar.gz"),
    "each version's source is a single object",
  );
  assert(
    landed.stdout.includes("1.html") && landed.stdout.includes("2.html"),
    "each version keeps its own build, so old versions stay previewable",
  );
  assert(
    !landed.stdout.includes("node_modules"),
    "node_modules is excluded from the snapshot",
  );
  assert(
    !landed.stdout.includes("/dist"),
    "dist is excluded from the snapshot",
  );

  // 5. A resumed sandbox must keep its live tree, not stamp on it.
  const resumed = await runCommand(sandbox, hydrateScript());
  assert(
    resumed.stdout.includes("RESUMED"),
    "hydrate leaves a non-empty working tree alone",
    resumed,
  );

  // 6. Losing the sandbox: wipe the tree and restore from R2.
  await runCommand(sandbox, `rm -rf ${GAME_ROOT}`);
  const rehydrated = await runCommand(sandbox, hydrateScript(), {
    timeoutSeconds: 120,
  });
  assert(
    rehydrated.stdout.includes("HYDRATED 2"),
    "hydrate restores the newest version",
    rehydrated,
  );
  const restored = await runCommand(
    sandbox,
    `cat ${GAME_ROOT}/src/scenario.ts && ls -1 ${GAME_ROOT}`,
  );
  assert(
    restored.stdout.includes(MARKER),
    "restored source is byte-identical",
    restored,
  );

  // 7. A dist with loose assets must be refused before anything is written.
  await runCommand(
    sandbox,
    `mkdir -p ${GAME_ROOT}/dist/assets && printf 'x' > ${GAME_ROOT}/dist/${PUBLISHED_FILE} && printf 'x' > ${GAME_ROOT}/dist/assets/app.js`,
  );
  const refused = await runCommand(sandbox, publishScript(), {
    timeoutSeconds: 120,
  });
  assert(
    !refused.success && refused.stdout.includes("NOT_SELF_CONTAINED"),
    "multi-file dist is refused",
    refused,
  );
  // Count tarballs, not entries: each version is a snapshot AND its build.
  const untouched = await runCommand(
    sandbox,
    `ls -1 ${R2_VERSIONS_DIR} | grep -c '\\.tar\\.gz$'`,
  );
  assert(
    untouched.stdout.trim() === "2",
    "the refused publish created no version 3",
    untouched,
  );

  console.log("\nAll smoke checks passed.");
} finally {
  await runCommand(
    sandbox,
    `rm -rf ${R2_VERSIONS_DIR} ${R2_CURRENT_DIR} ${GAME_ROOT}`,
    { timeoutSeconds: 120 },
  ).catch(() => undefined);
  await getDaytonaClient().delete(sandbox);
  log("sandbox.deleted");
}
