/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Mastra and the Daytona SDK ship Node-only code with dynamic requires
  // (Daytona lazily require()s busboy / form-data for fs.downloadFile and
  // fs.uploadFile); bundling them breaks those requires at runtime, so they
  // must be loaded from node_modules as-is.
  serverExternalPackages: ["@mastra/*", "@daytonaio/sdk"],
  // Skills are read from disk at request time (src/mastra/skills). Nothing
  // imports them, so Next would not otherwise ship them to the function.
  outputFileTracingIncludes: {
    "/api/chat": [".agents/skills/**"],
  },
};

export default config;
