import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    CLERK_SECRET_KEY: z.string().min(1),
    // Vercel AI Gateway key; model strings look like "anthropic/claude-sonnet-4.5".
    AI_GATEWAY_API_KEY: z.string().min(1).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DAYTONA_API_KEY: z.string().min(1),
    // Only needed for JWT auth; the SDK ignores it when DAYTONA_API_KEY is set
    // (the key is already scoped to an org server-side).
    DAYTONA_ORGANIZATION_ID: z.string().min(1).optional(),
    // Base snapshot (engine + skills + s3fs pre-installed). Optional: without
    // it sandboxes come up from Daytona's default image and are empty.
    DAYTONA_SNAPSHOT: z.string().min(1).optional(),
    // S3-compatible endpoint for the account, e.g.
    // https://<account-id>.r2.cloudflarestorage.com. Stored whole rather than
    // rebuilt from an account id: R2 also serves jurisdiction-specific hosts.
    R2_S3_ENDPOINT: z.string().url(),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET_NAME: z.string().min(1),
    // Public origin the bucket is served from. Only needed once games are
    // published for preview, so optional for now.
    R2_PUBLIC_BASE_URL: z.string().url().optional(),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
    DAYTONA_API_KEY: process.env.DAYTONA_API_KEY,
    DAYTONA_ORGANIZATION_ID: process.env.DAYTONA_ORGANIZATION_ID,
    DAYTONA_SNAPSHOT: process.env.DAYTONA_SNAPSHOT,
    R2_S3_ENDPOINT: process.env.R2_S3_ENDPOINT,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
