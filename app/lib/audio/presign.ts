// Pre-signed upload URL helpers for audio clips (GitHub #285).
//
// The browser PUTs file bytes directly to R2 — nothing is proxied through the
// Next server. Each URL is scoped to exactly one object key, signed for PUT
// only (a PutObjectCommand), and expires quickly so it can't be reused to write
// elsewhere later.

import { getR2RawBucket, signUploadUrl } from "../r2";

/** Pre-signed upload URLs expire after 5 minutes (security requirement). */
export const AUDIO_UPLOAD_URL_TTL_SECONDS = 5 * 60;

/** The object key is the ONLY object this upload URL may write to. */
export async function signClipUploadUrl(opts: {
  objectKey: string;
  mimeType: string;
  expiresIn?: number;
}): Promise<string> {
  return signUploadUrl({
    bucket: getR2RawBucket(),
    object: opts.objectKey,
    contentType: opts.mimeType,
    expiresIn: opts.expiresIn ?? AUDIO_UPLOAD_URL_TTL_SECONDS,
  });
}
