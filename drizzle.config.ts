import { type Config } from "drizzle-kit";

import { env } from "~/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  // Must match the prefix in src/server/db/schema.ts. Also what keeps
  // drizzle-kit away from the mastra_* tables @mastra/pg owns on this same
  // database: they are not modelled here, so an unfiltered push would drop them.
  tablesFilter: ["lessonplay_*"],
} satisfies Config;
