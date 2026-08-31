import type { Sandbox } from "@daytonaio/sdk";
import { SandboxState } from "@daytonaio/sdk";
import { describe, expect, it, vi } from "vitest";

import {
  isSandboxUnreachableError,
  planSandboxStep,
  withRecoveredSandbox,
} from "../lifecycle";

/** The exact message from the production incident (trace 65e76ce8). */
const CONTAINER_IP_ERROR =
  "bad request: failed to resolve container IP after 3 attempts: no IP address found. Is the Sandbox started?";

describe("planSandboxStep", () => {
  it("uses a started sandbox as-is", () => {
    expect(planSandboxStep(SandboxState.STARTED)).toBe("use");
  });

  it("starts sandboxes at rest", () => {
    expect(planSandboxStep(SandboxState.STOPPED)).toBe("start");
    expect(planSandboxStep(SandboxState.ARCHIVED)).toBe("start");
    expect(planSandboxStep(SandboxState.PAUSED)).toBe("start");
  });

  it("waits on sandboxes already on the way up", () => {
    expect(planSandboxStep(SandboxState.STARTING)).toBe("wait-started");
    expect(planSandboxStep(SandboxState.RESTORING)).toBe("wait-started");
    expect(planSandboxStep(SandboxState.RESUMING)).toBe("wait-started");
  });

  it("polls mid-transition states instead of using them (the incident)", () => {
    // A sandbox observed while Daytona archives it has no container; the old
    // code returned it as "existing-other" and every tool call failed.
    expect(planSandboxStep(SandboxState.ARCHIVING)).toBe("wait");
    expect(planSandboxStep(SandboxState.STOPPING)).toBe("wait");
    expect(planSandboxStep(SandboxState.PAUSING)).toBe("wait");
  });

  it("never returns 'use' for an unknown future state", () => {
    expect(planSandboxStep("some-new-state" as Sandbox["state"])).toBe("wait");
    expect(planSandboxStep(undefined)).toBe("wait");
  });

  it("fails fast on broken or terminal sandboxes", () => {
    expect(planSandboxStep(SandboxState.ERROR)).toBe("fail");
    expect(planSandboxStep(SandboxState.BUILD_FAILED)).toBe("fail");
    expect(planSandboxStep(SandboxState.DESTROYED)).toBe("fail");
    expect(planSandboxStep(SandboxState.DESTROYING)).toBe("fail");
  });
});

describe("isSandboxUnreachableError", () => {
  it("matches the production container-IP error", () => {
    expect(isSandboxUnreachableError(new Error(CONTAINER_IP_ERROR))).toBe(true);
  });

  it("matches non-Error throws too", () => {
    expect(isSandboxUnreachableError(CONTAINER_IP_ERROR)).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isSandboxUnreachableError(new Error("ENOENT: no such file"))).toBe(
      false,
    );
    expect(isSandboxUnreachableError(new Error("npm test failed"))).toBe(false);
  });
});

describe("withRecoveredSandbox", () => {
  const sandboxA = { id: "a" } as unknown as Sandbox;
  const sandboxB = { id: "b" } as unknown as Sandbox;

  it("runs against the resolved sandbox on the happy path", async () => {
    const recover = vi.fn();
    const result = await withRecoveredSandbox(
      Promise.resolve(sandboxA),
      recover,
      async (sandbox) => sandbox.id,
    );
    expect(result).toBe("a");
    expect(recover).not.toHaveBeenCalled();
  });

  it("recovers when the preparation promise itself died unreachable", async () => {
    const recover = vi.fn().mockResolvedValue(sandboxB);
    const result = await withRecoveredSandbox(
      Promise.reject(new Error(CONTAINER_IP_ERROR)),
      recover,
      async (sandbox) => sandbox.id,
    );
    expect(result).toBe("b");
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("recovers when the container dies under the call, and reruns it once", async () => {
    const recover = vi.fn().mockResolvedValue(sandboxB);
    const fn = vi
      .fn<(sandbox: Sandbox) => Promise<string>>()
      .mockRejectedValueOnce(new Error(CONTAINER_IP_ERROR))
      .mockImplementation(async (sandbox) => sandbox.id);
    const result = await withRecoveredSandbox(
      Promise.resolve(sandboxA),
      recover,
      fn,
    );
    expect(result).toBe("b");
    expect(fn).toHaveBeenNthCalledWith(1, sandboxA);
    expect(fn).toHaveBeenNthCalledWith(2, sandboxB);
  });

  it("recovers at most once", async () => {
    const recover = vi.fn().mockResolvedValue(sandboxB);
    const fn = vi.fn().mockRejectedValue(new Error(CONTAINER_IP_ERROR));
    await expect(
      withRecoveredSandbox(Promise.resolve(sandboxA), recover, fn),
    ).rejects.toThrow(/container IP/);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rethrows unrelated errors without recovering", async () => {
    const recover = vi.fn();
    await expect(
      withRecoveredSandbox(Promise.resolve(sandboxA), recover, async () => {
        throw new Error("old_string was not found");
      }),
    ).rejects.toThrow(/old_string/);
    expect(recover).not.toHaveBeenCalled();
  });

  it("does nothing special when no recover function is supplied", async () => {
    await expect(
      withRecoveredSandbox(
        Promise.reject(new Error(CONTAINER_IP_ERROR)),
        undefined,
        async (sandbox) => sandbox.id,
      ),
    ).rejects.toThrow(/container IP/);
  });
});
