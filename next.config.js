/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Mastra ships Node-only code with dynamic requires; keep it out of the webpack bundle.
  serverExternalPackages: ["@mastra/*"],
};

export default config;
