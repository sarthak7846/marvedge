// Cloudflare R2 storage helpers — the R2 replacement for the Google Cloud
// Storage code that used to live inline in each route.
//
// Server-only: this module reads credentials from env and is only safe to import
// from route handlers / server components. The SDK is S3-compatible, so this is
// a thin wrapper around @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner.
//
// Scheme convention (mirrors the old gs://):
//   r2://<bucket>/<object>
// A legacy gs://<bucket>/<object> URL (from before the migration) is handled in
// parseR2Uri/toHttpsUrl as a read-only passthrough to the public
// https://storage.googleapis.com/<bucket>/<object> URL — those buckets were
// already made public, so no GCS credentials are needed to serve them.

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

const R2_ENDPOINT = "https://r2.cloudflarestorage.com";
const DEFAULT_RAW_BUCKET = "raw";

export type R2ObjectRef = { bucket: string; object: string };

let client: S3Client | null = null;

function getR2Credentials() {
  const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing Cloudflare R2 credentials env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)"
    );
  }
  return { accountId, accessKeyId, secretAccessKey };
}

/** True when real R2 credentials are configured; false = Cloudinary testing mode. */
export function isR2Configured(): boolean {
  return Boolean(
    (process.env.R2_ACCOUNT_ID || "").trim() &&
    (process.env.R2_ACCESS_KEY_ID || "").trim() &&
    (process.env.R2_SECRET_ACCESS_KEY || "").trim()
  );
}

export function getR2Client(): S3Client {
  if (client) {
    return client;
  }
  const { accountId, accessKeyId, secretAccessKey } = getR2Credentials();
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}${R2_ENDPOINT}`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

/** The raw uploads bucket, from R2_RAW_BUCKET (falling back to "raw"). */
export function getR2RawBucket(): string {
  return (process.env.R2_RAW_BUCKET || process.env.GCP_RAW_BUCKET || DEFAULT_RAW_BUCKET).trim();
}

/**
 * Public https base URL for objects, when the bucket is public (custom domain or
 * r2.dev). Blank → signed URLs are the only way to read, and toHttpsUrl leaves
 * r2:// URIs untouched.
 */
function getR2PublicBaseUrl(): string {
  return (process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
}

export function parseR2Uri(uri: string): R2ObjectRef | null {
  if (typeof uri !== "string") {
    return null;
  }
  if (uri.startsWith("r2://")) {
    const raw = uri.slice("r2://".length);
    const slashIdx = raw.indexOf("/");
    if (slashIdx <= 0) {
      return null;
    }
    const bucket = raw.slice(0, slashIdx);
    const object = raw.slice(slashIdx + 1);
    if (!bucket || !object) {
      return null;
    }
    return { bucket, object };
  }
  // Legacy gs:// refs from before the R2 migration — the bucket was public, so
  // they can still be served via the public Google URL below.
  if (uri.startsWith("gs://")) {
    const raw = uri.slice("gs://".length);
    const slashIdx = raw.indexOf("/");
    if (slashIdx <= 0) {
      return null;
    }
    const bucket = raw.slice(0, slashIdx);
    const object = raw.slice(slashIdx + 1);
    if (!bucket || !object) {
      return null;
    }
    return { bucket, object };
  }
  return null;
}

/**
 * Convert a storage URI to a playable https URL. r2:// resolves via the public
 * base URL when the bucket is public; gs:// maps to the (already public)
 * storage.googleapis.com URL; anything else passes through unchanged.
 */
export function toHttpsUrl(url: string): string {
  const parsed = parseR2Uri(url);
  if (!parsed) {
    return url;
  }
  if (url.startsWith("gs://")) {
    return `https://storage.googleapis.com/${parsed.bucket}/${parsed.object}`;
  }
  const base = getR2PublicBaseUrl();
  if (base) {
    return `${base}/${parsed.object}`;
  }
  return url;
}

export async function signUploadUrl(opts: {
  bucket: string;
  object: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const s3 = getR2Client();
  const command = new PutObjectCommand({
    Bucket: opts.bucket,
    Key: opts.object,
    ContentType: opts.contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: opts.expiresIn ?? 15 * 60 });
}

export async function signReadUrl(opts: {
  bucket: string;
  object: string;
  expiresIn?: number;
}): Promise<string> {
  const s3 = getR2Client();
  const command = new GetObjectCommand({
    Bucket: opts.bucket,
    Key: opts.object,
  });
  return getSignedUrl(s3, command, { expiresIn: opts.expiresIn ?? 2 * 60 * 60 });
}

export async function uploadFile(opts: {
  bucket: string;
  object: string;
  sourcePath: string;
  contentType?: string;
}): Promise<void> {
  const fileStat = await stat(opts.sourcePath);
  const s3 = getR2Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: opts.bucket,
      Key: opts.object,
      Body: createReadStream(opts.sourcePath),
      ContentLength: fileStat.size,
      ContentType: opts.contentType || "application/octet-stream",
    })
  );
}

export async function downloadToFile(opts: {
  bucket: string;
  object: string;
  destinationPath: string;
}): Promise<void> {
  const s3 = getR2Client();
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: opts.bucket,
      Key: opts.object,
    })
  );
  if (!result.Body) {
    throw new Error(`R2 object has no body: ${opts.bucket}/${opts.object}`);
  }
  await pipeline(result.Body as NodeJS.ReadableStream, createWriteStream(opts.destinationPath));
}

export async function objectExists(opts: R2ObjectRef): Promise<boolean> {
  const s3 = getR2Client();
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: opts.bucket,
        Key: opts.object,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteObject(opts: R2ObjectRef): Promise<void> {
  const s3 = getR2Client();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: opts.bucket,
      Key: opts.object,
    })
  );
}

/**
 * R2 has no per-object ACL: public access is configured at the bucket level
 * (custom domain / r2.dev), so there is nothing to flip here. Kept so the worker
 * call sites read the same way they did with GCS's makePublic().
 */
export async function makePublic(): Promise<void> {
  return;
}
