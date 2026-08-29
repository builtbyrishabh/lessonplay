import "server-only";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "~/env";

/**
 * The app's ONLY direct S3 client.
 *
 * Everywhere else, R2 is reached through the sandbox's s3fs mount — the agent
 * works on local disk and crosses into the bucket once, at publish. Uploads
 * break that rule for one reason: a teacher attaches source material before the
 * first prompt, when no sandbox exists yet, so the bytes have to go straight
 * from the upload route into R2. The write lands under the same
 * games/<userId>/<threadId>/ prefix the sandbox later mounts, so the agent sees
 * it at ~/r2/uploads/ with no extra plumbing.
 *
 * Lazily constructed and memoised so importing this module never fails when the
 * env is unset (e.g. the no-DB test run); the client is built on first use.
 */
let client: S3Client | null = null;

function r2(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: env.R2_S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

/** Write one object to the games bucket. Key is computed by the caller. */
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Public URL for a key, or null when no public base is configured.
 *
 * R2 public access is bucket-wide: this serves ANY key — published games and
 * uploads alike — so the only thing between an object and the internet is an
 * unguessable path. Keep that in mind when choosing object names.
 */
export function publicObjectUrl(key: string): string | null {
  const base = env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** The longest lifetime SigV4 allows a presigned URL: 7 days. */
const PRESIGN_MAX_SECONDS = 7 * 24 * 60 * 60;

/**
 * The URL an uploaded file is handed to the model as.
 *
 * It is stored in Memory and re-sent — and re-fetched by the AI Gateway — on
 * EVERY later turn of the thread, so it must not lapse: a signed link that
 * expired mid-thread would 403 every turn after it. The public URL never
 * expires; without a public base, the longest signature available is the best
 * a private bucket can do.
 */
export async function uploadReadUrl(key: string): Promise<string> {
  const publicUrl = publicObjectUrl(key);
  if (publicUrl) return publicUrl;
  return getSignedUrl(
    r2(),
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
    { expiresIn: PRESIGN_MAX_SECONDS },
  );
}

/**
 * A short-lived presigned PUT URL the browser uploads one file straight to.
 *
 * Uploads used to pass through the app server; now the browser PUTs bytes
 * directly to R2, so a large PDF never counts against the function's
 * request-body limit and never buffers in memory. The `ContentType` is bound
 * into the signature, so the PUT must send the same `Content-Type` header —
 * that's how the route pins the object's type without seeing the bytes. Five
 * minutes is plenty to begin the upload.
 */
export async function presignUploadUrl(
  key: string,
  contentType: string,
): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 5 * 60 },
  );
}
