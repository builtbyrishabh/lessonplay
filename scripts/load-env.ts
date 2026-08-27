/**
 * Loads .env into process.env for standalone scripts (`~/env` reads process.env
 * and Next.js is not doing it for us here). Import this FIRST — ESM evaluates
 * imports in declaration order, so it must sit above any `../src/...` import.
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
