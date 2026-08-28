/**
 * The headless build-time gate, as a command.
 *
 * `validateExperimentMission` / `validateSandboxLabMission` are the real gates;
 * this only locates the authored game and reports what they say. It exists so
 * the gate can be *enforced* rather than asserted: the app's `validate` tool and
 * its `publish` tool run this exact command, so "the game is completable" stops
 * being a claim the generating agent makes about its own work.
 *
 *   tsx bin/validate.ts [gameRoot]     # defaults to the current directory
 *
 * The game says where its data lives, in its own package.json:
 *
 *   "lessonplay": { "entry": "src/content/missions.ts", "export": "myGame" }
 *
 * Exit codes are three-valued on purpose — a caller must be able to tell "your
 * game is broken" from "I could not find your game", because the fix differs:
 *
 *   0  the game passed every stage of the gate
 *   1  the gate found errors
 *   2  the game could not be located or its shape was not recognised
 *
 * Never exits 0 on a game it could not read. A gate that silently passes when it
 * finds nothing is worse than no gate: it would certify an unplayable game.
 */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isAbsolute, resolve } from "node:path";

import type { ExperimentGame } from "../src/model/experimentLab.ts";
import type { SandboxLabMission } from "../src/model/sandboxLab.ts";
import type { ValidationResult } from "../src/model/scenario.ts";
import { solveExperiment } from "../src/engine/solveExperiment.ts";
import { validateExperimentMission } from "../src/engine/validateExperimentGame.ts";
import { validateSandboxLabMission } from "../src/engine/validateSandboxLabMission.ts";

const CONFIG_ERROR = 2;
const GATE_ERROR = 1;

/** Per-level quality detail, reported so the agent can fix design, not just errors. */
interface LevelReport {
  readonly levelId: string;
  readonly goalKind: string;
  readonly winnable: boolean;
  readonly bruteForceable: boolean;
  readonly railed: boolean;
  /** Smallest action set that separates every category; `null` when unwinnable. */
  readonly toolsNeeded: number | null;
  readonly indistinguishablePairs: readonly (readonly [string, string])[];
}

interface ItemReport {
  readonly id: string;
  readonly kind: "experiment-lab" | "chemquest-lab";
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly levels?: readonly LevelReport[];
}

interface Report {
  readonly ok: boolean;
  readonly entry: string;
  readonly export: string;
  readonly items: readonly ItemReport[];
  /** Every item's errors, flattened — what a caller shows when it shows one thing. */
  readonly errors: readonly string[];
}

function fail(message: string, hint?: string): never {
  const payload = { ok: false, error: message, ...(hint ? { hint } : {}) };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(CONFIG_ERROR);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isExperimentGame(value: unknown): value is ExperimentGame {
  return (
    isRecord(value) &&
    isRecord(value.definition) &&
    Array.isArray(value.levels) &&
    Array.isArray(value.categories)
  );
}

function isSandboxLabMission(value: unknown): value is SandboxLabMission {
  return (
    isRecord(value) && isRecord(value.scenario) && isRecord(value.presentation)
  );
}

/** `Infinity` is not JSON; report an unreachable goal as null instead. */
function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function reportExperiment(game: ExperimentGame, index: number): ItemReport {
  const id = game.id || `game-${index + 1}`;
  try {
    return reportExperimentUnsafe(game, id);
  } catch (err) {
    // Malformed data the structural pass did not anticipate. The caller shows
    // `errors` to the model; a stack trace on stderr and exit 1 shows nothing.
    const message = err instanceof Error ? err.message : String(err);
    return {
      id,
      kind: "experiment-lab",
      ok: false,
      errors: [
        `the gate crashed while analysing this game: ${message}. The game data is malformed — check every rule has a \`when\` (use {} for any state), every effect has observationId/observation/visual, and every level names existing sample and tool ids.`,
      ],
    };
  }
}

function reportExperimentUnsafe(game: ExperimentGame, id: string): ItemReport {
  const result = validateExperimentMission(game);
  return {
    id,
    kind: "experiment-lab",
    ok: result.ok,
    errors: result.errors,
    levels: game.levels.map((level) => {
      const a = solveExperiment(game.definition, level);
      return {
        levelId: a.levelId,
        goalKind: a.goalKind,
        winnable: a.winnable,
        bruteForceable: a.bruteForceable,
        railed: a.railed,
        toolsNeeded: finiteOrNull(a.toolsNeeded),
        indistinguishablePairs: a.indistinguishablePairs,
      };
    }),
  };
}

function reportMission(mission: SandboxLabMission, index: number): ItemReport {
  const result: ValidationResult = validateSandboxLabMission(mission);
  return {
    id: mission.scenario.id || `mission-${index + 1}`,
    kind: "chemquest-lab",
    ok: result.ok,
    errors: result.errors,
  };
}

/**
 * Flatten whatever the game exported into the list of things to gate.
 *
 * The authoring surface is deliberately forgiving — a single game, a single
 * mission, a collection with a `missions` array, or an array of any of those —
 * because which one a template exports is a detail of that template, not
 * something the gate should dictate. An unrecognised shape is a hard error.
 */
function collect(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(collect);
  if (isRecord(value) && Array.isArray(value.missions)) {
    return value.missions.flatMap(collect);
  }
  return [value];
}

async function main(): Promise<void> {
  const gameRootArg = process.argv[2] ?? process.cwd();
  const gameRoot = isAbsolute(gameRootArg)
    ? gameRootArg
    : resolve(process.cwd(), gameRootArg);

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(
      await readFile(resolve(gameRoot, "package.json"), "utf-8"),
    ) as Record<string, unknown>;
  } catch {
    fail(
      `No package.json in ${gameRoot}, so there is no game to validate.`,
      "Run this from the game project directory.",
    );
  }

  const config = manifest.lessonplay;
  if (!isRecord(config)) {
    fail(
      "package.json has no `lessonplay` field, so the gate cannot find the game data.",
      'Add: "lessonplay": { "entry": "src/content/missions.ts", "export": "myGame" }',
    );
  }
  const entry = config.entry;
  const exportName = config.export;
  if (typeof entry !== "string" || typeof exportName !== "string") {
    fail(
      "`lessonplay` must set both `entry` (a file path) and `export` (a named export in it).",
      'Example: "lessonplay": { "entry": "src/content/missions.ts", "export": "myGame" }',
    );
  }

  let namespace: Record<string, unknown>;
  try {
    namespace = (await import(
      pathToFileURL(resolve(gameRoot, entry)).href
    )) as Record<string, unknown>;
  } catch (err) {
    fail(
      `Could not import "${entry}": ${err instanceof Error ? err.message : String(err)}`,
      "The gate runs the module, so it must import cleanly — fix the error above first.",
    );
  }

  if (!(exportName in namespace)) {
    fail(
      `"${entry}" has no export named "${exportName}".`,
      `It exports: ${Object.keys(namespace).join(", ") || "nothing"}`,
    );
  }

  const items = collect(namespace[exportName]);
  const reports: ItemReport[] = [];
  for (const [index, item] of items.entries()) {
    if (isExperimentGame(item)) {
      reports.push(reportExperiment(item, index));
    } else if (isSandboxLabMission(item)) {
      reports.push(reportMission(item, index));
    } else {
      fail(
        `Export "${exportName}" is not a game the gate recognises.`,
        "Expected an ExperimentGame (definition + categories + levels), a SandboxLabMission (scenario + presentation), or a collection with a `missions` array.",
      );
    }
  }

  if (reports.length === 0) {
    fail(
      `Export "${exportName}" holds no games or missions to validate.`,
      "An empty collection would otherwise pass the gate without checking anything.",
    );
  }

  const report: Report = {
    ok: reports.every((item) => item.ok),
    entry,
    export: exportName,
    items: reports,
    errors: reports.flatMap((item) => item.errors),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.ok ? 0 : GATE_ERROR);
}

await main();
