/**
 * Command execution against a Daytona sandbox.
 *
 * Deliberately separate from ./daytona.ts: that module imports `~/env` at load
 * time (client construction), which would drag env validation into the agent /
 * tool import graph. Everything here is env-free, so `~/mastra/tools/*` can
 * import it and stay unit-testable.
 */
import type { Sandbox } from "@daytonaio/sdk";

/** Thin, typed wrapper so callers never touch the SDK's result shape. */
export async function runCommand(
  sandbox: Sandbox,
  command: string,
  opts?: {
    cwd?: string;
    env?: Record<string, string>;
    timeoutSeconds?: number;
  },
): Promise<{ stdout: string; exitCode: number; success: boolean }> {
  const res = await sandbox.process.executeCommand(
    command,
    opts?.cwd,
    opts?.env,
    opts?.timeoutSeconds,
  );
  const exitCode = res.exitCode ?? 0;
  return { stdout: res.result ?? "", exitCode, success: exitCode === 0 };
}

/** Single-quote a path/argument so spaces and shell metacharacters stay literal. */
export function quoteShellArg(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
