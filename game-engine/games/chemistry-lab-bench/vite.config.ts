import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [
    react(),
    // The published game is ONE self-contained dist/index.html. That is what
    // lets `publish` be a single object write — atomic, with no second asset
    // request that could 404 against a half-uploaded build.
    viteSingleFile(),
  ],
  build: {
    // Belt and braces: keep the plugin from having anything left to inline.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
  },
  server: {
    // Allow phone testing through an ngrok tunnel. The leading dot matches all
    // subdomains, so a new random ngrok URL each run still works.
    allowedHosts: [".ngrok-free.app", ".ngrok.io", ".ngrok.app"],
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: "./tests/setup.ts",
  },
});
