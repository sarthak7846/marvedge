// HMAC signing for the generic webhook provider.
//
// The receiver of a webhook has no other way to know a POST came from us — the
// URL is a bearer secret at best, and it ends up in logs, proxies and bug
// reports. A signature over the body means a leaked URL is not a forgery
// primitive.
//
// THE SCHEME, so a customer can implement the other half from this comment
// alone (it is also written out in ./README.md with a worked example):
//
//   X-Marvedge-Timestamp: 1700000000              ← unix SECONDS
//   X-Marvedge-Signature: sha256=<hex>            ← lowercase hex
//
//   signature = HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
//
// The timestamp is INSIDE the signed string, not just alongside it: signing the
// body alone lets an attacker who captured one request replay it forever. A
// receiver should reject a timestamp outside a few minutes of its own clock —
// that check is theirs to make, which is why the timestamp travels in its own
// header where it can be read before the body is parsed.
//
// The signature covers THE EXACT BYTES SENT. A receiver must verify against the
// raw request body, not against a re-serialisation of the parsed JSON — key
// order and whitespace would differ and every signature would fail.
//
// node:crypto, so this module is server-only. It is separate from ./webhook.ts
// so the scheme can be tested against a hand-computed fixture without a network
// stub anywhere near it.

import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "X-Marvedge-Signature";
export const TIMESTAMP_HEADER = "X-Marvedge-Timestamp";

/** Prefix on the signature value, so the algorithm can change without ambiguity. */
export const SIGNATURE_PREFIX = "sha256=";

/** The exact string the HMAC is computed over. Exported so tests can assert it. */
export function signedPayload(timestampSeconds: number | string, rawBody: string): string {
  return `${timestampSeconds}.${rawBody}`;
}

/** `sha256=<lowercase hex>` for the `X-Marvedge-Signature` header. */
export function signWebhookPayload(
  secret: string,
  timestampSeconds: number | string,
  rawBody: string
): string {
  const digest = createHmac("sha256", secret)
    .update(signedPayload(timestampSeconds, rawBody), "utf8")
    .digest("hex");
  return `${SIGNATURE_PREFIX}${digest}`;
}

/**
 * The receiver-side check, exported so the "test connection" path and the test
 * suite verify with the same code a customer would write.
 *
 * Constant-time, and length-checked first because timingSafeEqual throws on a
 * length mismatch rather than returning false.
 */
export function verifyWebhookSignature(
  secret: string,
  timestampSeconds: number | string,
  rawBody: string,
  candidate: string
): boolean {
  if (typeof candidate !== "string") {
    return false;
  }
  const expected = Buffer.from(signWebhookPayload(secret, timestampSeconds, rawBody), "utf8");
  const provided = Buffer.from(candidate, "utf8");
  if (expected.length !== provided.length) {
    return false;
  }
  return timingSafeEqual(expected, provided);
}
