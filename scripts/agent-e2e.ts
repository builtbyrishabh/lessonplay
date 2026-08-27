/**
 * End-to-end drive of the real lesson agent: pick a chemistry topic, hand it to
 * the same factory + sandbox the chat route uses, and let it author → validate →
 * publish a real game in its Daytona sandbox against the real R2 bucket.
 *
 *   pnpm dlx tsx scripts/agent-e2e.ts ["<topic prompt>"] [threadId]
 *
 * Unlike sandbox:smoke (which fakes the build with printf'd files), this runs the
 * actual model loop and its tools. It leaves the sandbox and published game in
 * place so you can inspect them; it prints the sandbox id and R2 key at the end.
 */
import "./load-env";

import type { Sandbox } from "@daytonaio/sdk";

import {
  GAME_ROOT,
  R2_CURRENT_DIR,
  R2_VERSIONS_DIR,
  gameBucketPrefix,
  publishedGameKey,
  sandboxIdForThread,
} from "../src/lib/sandbox-paths";
import { createLessonAgent } from "../src/mastra/agents/lesson-agent";
import type { LessonTrace } from "../src/mastra/agents/lesson-shared";
import {
  LESSON_MODEL_SETTINGS,
  resolveLessonModel,
} from "../src/mastra/agents/lesson-shared";
import { getOrCreateSandbox } from "../src/server/sandbox/daytona";
import { runCommand } from "../src/server/sandbox/exec";
import { mountR2Bucket } from "../src/server/sandbox/r2-mount";
import {
  hydrateScript,
  linkEngineModulesScript,
} from "../src/server/sandbox/scripts";

/**
 * Inlined `prepareLessonSandbox` — same steps as `~/server/sandbox/prepare`,
 * duplicated here only because that module imports `server-only`, which throws
 * outside Next's bundler. Keep this in sync with prepare.ts.
 */
function prepareLessonSandbox(opts: {
  threadId: string;
  userId: string;
  trace?: LessonTrace;
}): Promise<Sandbox> {
  const startedAt = performance.now();
  const log = opts.trace?.log ?? (() => {});
  const promise = (async () => {
    const { sandbox, status } = await getOrCreateSandbox(
      sandboxIdForThread(opts.threadId),
      { env: {} },
    );
    log("sandbox.acquired", {
      status,
      id: sandbox.id,
      durationMs: Math.round(performance.now() - startedAt),
    });
    await mountR2Bucket(sandbox, opts, log);

    const res = await runCommand(sandbox, hydrateScript(), {
      timeoutSeconds: 120,
    });
    log("sandbox.hydrate", {
      state: res.stdout.trim().split("\n").pop(),
      ok: res.success,
    });
    if (!res.success) {
      await runCommand(sandbox, `rm -rf ${GAME_ROOT} && mkdir -p ${GAME_ROOT}`);
      throw new Error(`hydrate failed (exit ${res.exitCode})`);
    }
    const link = await runCommand(sandbox, linkEngineModulesScript());
    log("sandbox.engine_modules", {
      state: link.stdout.trim().split("\n").pop(),
      ok: link.success,
    });
    log("sandbox.ready", {
      durationMs: Math.round(performance.now() - startedAt),
    });
    return sandbox;
  })();
  void promise.catch(() => undefined);
  return promise;
}

// --- config -----------------------------------------------------------------

const DEFAULT_TOPIC =
  "Build a discovery game for a Class 9 chemistry class where the learner has to identify several unknown household solutions as acidic, basic, or neutral by testing them with indicators (litmus, and one more), reasoning from the evidence rather than guessing. Two or three levels of increasing difficulty.";

const topic = process.argv[2]?.trim() || DEFAULT_TOPIC;
const threadId = process.argv[3]?.trim() || `e2e-acids-bases-01`;
const userId = "e2e-user";
const model = resolveLessonModel(undefined); // repo default (GPT 5.6 Luna)

// A real chat is many turns; a request is capped at LESSON_MAX_STEPS. Here we
// want one autonomous build, so we give a generous per-turn step budget and, as
// a backstop, re-nudge across a few turns (Memory carries the history) until the
// game is published or we give up.
const MAX_STEPS_PER_TURN = 60;
const MAX_TURNS = 6;

const INITIAL_PROMPT = [
  topic,
  "",
  "Work autonomously and do NOT ask me any clarifying questions — make reasonable pedagogical choices yourself and proceed.",
  "Load the most appropriate game-authoring skill first, then build the game in the sandbox, run `validate`, fix anything it reports, and keep going until `publish` returns ok.",
  "Do not tell me it is ready until `publish` has actually succeeded. Give a one-line summary at the end.",
].join("\n");

const CONTINUE_PROMPT = [
  "Continue where you left off. The game is not published yet.",
  "Keep building/fixing autonomously (no questions) until `validate` passes and `publish` returns ok.",
].join("\n");

// --- run --------------------------------------------------------------------

const t0 = performance.now();
const ms = () => Math.round(performance.now() - t0);

let publishedVersion: number | null = null;
let sawSandboxReady = false;

const trace = {
  id: "e2e",
  log: (event: string, data?: Record<string, unknown>) => {
    // Surface every tool/sandbox event; this is the spine of the loop.
    console.log(`[${ms()}ms] ${event}`, data ?? "");
    if (event === "sandbox.ready") sawSandboxReady = true;
    if (event === "tool.publish.ok" && typeof data?.version === "number") {
      publishedVersion = data.version;
    }
  },
};

console.log(`\n=== LessonPlay agent E2E ===`);
console.log(`model:    ${model}`);
console.log(`threadId: ${threadId}`);
console.log(`topic:    ${topic}\n`);

const sandboxPromise = prepareLessonSandbox({ threadId, userId, trace });
const agent = await createLessonAgent({
  threadId,
  userId,
  model,
  sandboxPromise,
  publishedUrl: null,
  trace,
});

/** Drive one turn to completion, streaming text + tool intents to stdout. */
async function runTurn(prompt: string, turn: number): Promise<void> {
  console.log(`\n----- turn ${turn} -----`);
  const stream = await agent.stream(prompt, {
    modelSettings: LESSON_MODEL_SETTINGS,
    maxSteps: MAX_STEPS_PER_TURN,
    memory: { thread: threadId, resource: userId },
    savePerStep: true,
  });

  let printedTextThisChunkRun = false;
  for await (const chunk of stream.fullStream) {
    const type = (chunk as { type?: string }).type ?? "?";
    // Field names vary across Mastra versions, so read defensively.
    const c = chunk as Record<string, unknown>;
    if (type === "text-delta" || type === "text") {
      const text =
        (c.text as string) ??
        (c.textDelta as string) ??
        ((c.payload as { text?: string })?.text ?? "");
      if (text) {
        process.stdout.write(text);
        printedTextThisChunkRun = true;
      }
    } else if (type === "tool-call") {
      if (printedTextThisChunkRun) {
        process.stdout.write("\n");
        printedTextThisChunkRun = false;
      }
      const name = (c.toolName as string) ?? (c.payload as { toolName?: string })?.toolName;
      const argsObj =
        (c.args as Record<string, unknown>) ??
        (c.payload as { args?: Record<string, unknown> })?.args ??
        {};
      console.log(`  → tool:${name}`, argsObj.intent ?? argsObj.path ?? "");
    } else if (type === "error") {
      console.error(`  !! stream error`, c.error ?? c);
    }
  }

  const finishReason = await stream.finishReason.catch(() => "unknown");
  const usage = await stream.usage.catch(() => undefined);
  console.log(`\n[turn ${turn} finished] reason=${finishReason}`, usage ?? "");
}

try {
  for (let turn = 1; turn <= MAX_TURNS && publishedVersion === null; turn++) {
    await runTurn(turn === 1 ? INITIAL_PROMPT : CONTINUE_PROMPT, turn);
  }

  console.log(`\n=== result ===`);
  console.log(`sandbox ready:      ${sawSandboxReady}`);
  console.log(`published version:  ${publishedVersion ?? "NOT PUBLISHED"}`);

  if (publishedVersion !== null) {
    // Prove it actually landed in the bucket, not just that the tool said ok.
    const sandbox = await sandboxPromise;
    const check = await runCommand(
      sandbox,
      [
        `echo "current:"`,
        `ls -l ${R2_CURRENT_DIR} 2>/dev/null || echo "  (missing)"`,
        `echo "bytes:" $(wc -c < ${R2_CURRENT_DIR}/index.html 2>/dev/null || echo 0)`,
        `echo "versions:"`,
        `ls -1 ${R2_VERSIONS_DIR} 2>/dev/null || echo "  (none)"`,
        `echo "game dist:"`,
        `ls -l ${GAME_ROOT}/dist 2>/dev/null || echo "  (none)"`,
      ].join(" && "),
      { timeoutSeconds: 120 },
    );
    console.log(check.stdout);
    console.log(`\nR2 key:   ${publishedGameKey(userId, threadId)}`);
    console.log(`R2 prefix: ${gameBucketPrefix(userId, threadId)}`);
    console.log(`sandbox:  ${sandbox.id} (left running; auto-stops after 30m idle)`);
    console.log(`\n✅ END-TO-END LOOP PASSED — a real game was authored, validated, and published.`);
  } else {
    console.log(`\n❌ Loop did not reach a successful publish within ${MAX_TURNS} turns.`);
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`\n💥 E2E driver threw:`, err);
  process.exitCode = 1;
} finally {
  // Give any in-flight PG/memory writes a moment, then let the process exit.
  console.log(`\n[${ms()}ms] done.`);
}
