import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SANDBOX_HOME } from "~/lib/sandbox-paths";
import { scaffoldTemplateScript } from "../scripts";

/**
 * Runs the real scaffold script, with /home/daytona swapped for a temp dir,
 * against the real template checked into game-engine/. Shell + tar only, so
 * it runs anywhere the unit tests do — no Daytona.
 */

const TEMPLATE_SOURCE = path.resolve(
  process.cwd(),
  "game-engine/games/chemistry-lab-bench",
);

let home: string;

function run(): { stdout: string; code: number } {
  const script = scaffoldTemplateScript().replaceAll(SANDBOX_HOME, home);
  try {
    return { stdout: execFileSync("bash", ["-c", script]).toString(), code: 0 };
  } catch (err) {
    const e = err as { status: number; stdout: Buffer };
    return { stdout: e.stdout.toString(), code: e.status };
  }
}

function last(stdout: string): string {
  return stdout.trim().split("\n").pop() ?? "";
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "lessonplay-scaffold-"));
  const template = path.join(home, "engine/games/chemistry-lab-bench");
  fs.cpSync(TEMPLATE_SOURCE, template, { recursive: true });
  // Things the sandbox's copy may hold that must not come across.
  fs.mkdirSync(path.join(template, "node_modules/x"), { recursive: true });
  fs.writeFileSync(path.join(template, "node_modules/x/y.js"), "");
  fs.mkdirSync(path.join(template, "dist"), { recursive: true });
  fs.writeFileSync(path.join(template, "dist/index.html"), "<html>");
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe("scaffoldTemplateScript", () => {
  it("copies the template sources into an empty working tree", () => {
    const res = run();
    expect(res.code).toBe(0);
    expect(last(res.stdout)).toBe("SCAFFOLDED");

    const game = path.join(home, "game");
    for (const file of [
      "package.json",
      "index.html",
      "vite.config.ts",
      "src/main.tsx",
      "src/ui/App.tsx",
      "src/content/missions.ts",
      "tests/missions.test.ts",
    ]) {
      expect(fs.existsSync(path.join(game, file)), file).toBe(true);
    }
    expect(fs.existsSync(path.join(game, "node_modules"))).toBe(false);
    expect(fs.existsSync(path.join(game, "dist"))).toBe(false);

    // The prompt promises the gate can find the game as scaffolded.
    const manifest = JSON.parse(
      fs.readFileSync(path.join(game, "package.json"), "utf8"),
    ) as { lessonplay?: { entry?: string; export?: string } };
    expect(manifest.lessonplay).toEqual({
      entry: "src/content/missions.ts",
      export: "chemistryLabTemplate",
    });
  });

  it("leaves a non-empty working tree alone", () => {
    fs.mkdirSync(path.join(home, "game"), { recursive: true });
    fs.writeFileSync(path.join(home, "game/mine.txt"), "teacher's game");
    const res = run();
    expect(res.code).toBe(0);
    expect(last(res.stdout)).toBe("KEPT");
    expect(fs.readdirSync(path.join(home, "game"))).toEqual(["mine.txt"]);
  });

  it("fails loudly when the base image has no template", () => {
    fs.rmSync(path.join(home, "engine"), { recursive: true });
    const res = run();
    expect(res.code).toBe(2);
    expect(last(res.stdout)).toBe("NO_TEMPLATE");
    // And leaves nothing half-made behind for the prompt to lie about.
    expect(fs.readdirSync(path.join(home, "game"))).toEqual([]);
  });
});
