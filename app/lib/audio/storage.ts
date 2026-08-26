// Storage helpers for the audio feature (GitHub #285).
//
// Audio objects live in the same R2 raw bucket the rest of the app uploads to
// (`getR2RawBucket()`). Keys are stored as bare object keys on AudioClip
// (`originalKey` / `trimmedKey`); this module turns them into playable URLs and
// cleans them up.

import { randomUUID } from "node:crypto";
import { deleteObject, getR2RawBucket, isR2Configured, signReadUrl } from "../r2";
import { deleteCloudinaryVideoByUrl } from "../cloudinary-utils";

/** Cloudinary-hosted objects are stored as full https URLs in the key column. */
function isHttpUrl(key: string): boolean {
  return key.startsWith("http://") || key.startsWith("https://");
}

/**
 * Testing-mode trim: Cloudinary applies start/end offsets via URL
 * transformations (`so_/eo_`) with no server-side ffmpeg involved.
 */
export function cloudinaryTrimmedAudioUrl(
  url: string,
  trimStartSec: number,
  trimEndSec: number | null
): string | null {
  if (!isHttpUrl(url)) {
    return null;
  }
  const endPart = trimEndSec !== null ? `,eo_${trimEndSec}` : "";
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) {
    return null;
  }
  return `${url.slice(0, idx + marker.length)}so_${trimStartSec}${endPart}/${url.slice(idx + marker.length)}`;
}

/**
 * Testing-mode playable URL resolution: prefer the trimmed transformation when
 * a meaningful trim window exists on a Cloudinary-hosted clip.
 */
export async function resolveTestingPlayableUrls(
  objectKey: string,
  trimmedKey: string | null,
  trimStartSec: number,
  trimEndSec: number | null
): Promise<{ originalUrl: string; trimmedUrl: string | null }> {
  const originalUrl = await audioPlayableUrl(objectKey);
  const hasWindow = trimStartSec > 0 || (trimEndSec !== null && Number.isFinite(trimEndSec));
  const trimmedUrl =
    trimmedKey ??
    (hasWindow ? cloudinaryTrimmedAudioUrl(originalUrl, trimStartSec, trimEndSec) : null);
  return { originalUrl, trimmedUrl };
}

/**
 * Build a single object key scoped to a demo + user, e.g.
 * `audio/{demoId}/{userId}/{timestamp}-{uuid}.mp3`.
 */
export function buildAudioObjectKey(opts: {
  demoId: string;
  userId: string;
  ext: string;
  subdir?: string;
}): string {
  const dir = opts.subdir ? `${opts.subdir}/` : "";
  const suffix = opts.ext ? `.${opts.ext}` : "";
  return `audio/${opts.demoId}/${opts.userId}/${dir}${Date.now()}-${randomUUID()}${suffix}`;
}

/**
 * Resolve an audio object key to a playable https URL. Cloudinary URLs pass
 * through unchanged; R2 keys use the configured public base URL when the bucket
 * is public, otherwise a short-lived signed read URL. Returns "" when the key
 * cannot be resolved (e.g. R2 not configured) so callers can treat it as absent.
 */
export async function audioPlayableUrl(objectKey: string): Promise<string> {
  if (!objectKey || isHttpUrl(objectKey)) {
    return objectKey;
  }
  const publicBase = (process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (publicBase) {
    return `${publicBase}/${objectKey}`;
  }
  if (!isR2Configured()) {
    return "";
  }
  try {
    return await signReadUrl({
      bucket: getR2RawBucket(),
      object: objectKey,
      expiresIn: 2 * 60 * 60,
    });
  } catch (error) {
    console.error("[audio] failed to sign read URL:", error);
    return "";
  }
}

/** Best-effort deletion of audio objects (R2 keys or Cloudinary URLs). Never throws. */
export async function deleteAudioObjects(objectKeys: Array<string | null>): Promise<void> {
  for (const key of objectKeys) {
    if (!key) {
      continue;
    }
    try {
      if (isHttpUrl(key)) {
        await deleteCloudinaryVideoByUrl(key);
      } else if (isR2Configured()) {
        await deleteObject({ bucket: getR2RawBucket(), object: key });
      }
    } catch (error) {
      console.error(`[audio] failed to delete audio object ${key}:`, error);
    }
  }
}
