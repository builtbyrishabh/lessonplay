/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Mastra ships Node-only code with dynamic requires; keep it out of the webpack bundle.
  serverExternalPackages: ["@mastra/*"],
  // Skills are read from disk at request time (src/mastra/skills). Nothing
  // imports them, so Next would not otherwise ship them to the function.
  outputFileTracingIncludes: {
    "/api/chat": [".agents/skills/**"],
  },
};

export default config;
