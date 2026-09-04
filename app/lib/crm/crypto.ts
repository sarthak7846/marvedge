// Authenticated encryption for CrmConnection.credentials.
//
// THIS IS THE FIRST PER-USER SECRET THIS APPLICATION STORES. Everything else in
// the database is either the user's own content or an id; a HubSpot Private App
// token is a live credential into somebody else's CRM. A plaintext JSON column
// would mean a read-only leak of the database is a write credential into every
// customer's CRM, so it is not an option.
//
// AES-256-GCM, from node:crypto — no new dependency. GCM rather than CBC because
// it AUTHENTICATES: a tampered ciphertext fails to decrypt instead of quietly
// producing different plaintext. What lands in the column is an envelope, never
// a bare string, so the format can be versioned when it needs to be.
//
// NODE ONLY. This module is not part of app/lib/overlays/ and is deliberately
// not isomorphic — it must never be imported by a client component. Nothing in
// here is safe to send to a browser.
//
// ============================================================================
// THE ONE RULE
// ============================================================================
// A decrypted credential never leaves this process. It is not logged, not
// echoed by a route, not attached to an Error, not included in `lastError`.
// The settings UI is shown a masked hint from ./mask.ts and nothing else.
//
// ============================================================================
// KEYS AND ROTATION
// ============================================================================
// OVERLAYS_CRM_SECRET_KEY          — base64 of 32 random bytes. Used to ENCRYPT.
// OVERLAYS_CRM_SECRET_KEY_PREVIOUS — optional, accepted on DECRYPT only.
//
// To rotate: move the current key to …_PREVIOUS, put a fresh one in the primary,
// deploy. Everything already stored still decrypts under the previous key; the
// next save of a connection re-encrypts it under the new one. Once every
// connection has been re-saved (or simply re-entered by its owner), drop
// …_PREVIOUS. There is no re-encrypt job in this PR, deliberately: a background
// job that decrypts every credential in the database is a bigger liability than
// the two-key window it saves.
//
// If the primary key is ABSENT, encryption FAILS LOUDLY. Writing a credential
// in plaintext because an environment variable was forgotten is exactly the
// failure this module exists to prevent, so creation errors instead.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Envelope version. Bump only if the algorithm or field set changes. */
const ENVELOPE_VERSION = 1;

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
/** 96 bits, the size GCM is specified for. */
const IV_BYTES = 12;

export const CRM_SECRET_KEY_ENV = "OVERLAYS_CRM_SECRET_KEY";
export const CRM_SECRET_KEY_PREVIOUS_ENV = "OVERLAYS_CRM_SECRET_KEY_PREVIOUS";

/**
 * What is stored in the `credentials` JSON column. All fields base64.
 *
 * The index signature is not decoration: Prisma's `InputJsonObject` requires
 * one, and without it this cannot be assigned to a Json column without a cast.
 */
export interface CredentialEnvelope {
  v: number;
  iv: string;
  tag: string;
  ct: string;
  [key: string]: string | number;
}

/**
 * Thrown when the key is missing or unusable. A distinct class so a route can
 * answer 503-with-an-explanation rather than a generic 500 — a missing key is
 * an operator problem, and telling the operator plainly is the point.
 */
export class CrmCryptoUnconfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrmCryptoUnconfiguredError";
  }
}

function readKey(envName: string): Buffer | null {
  const raw = process.env[envName];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw.trim(), "base64");
  } catch {
    return null;
  }
  // A short key silently "works" with some APIs and produces weak encryption
  // with others. Treat it as absent rather than as a key.
  return key.length === KEY_BYTES ? key : null;
}

/**
 * Whether credentials can be encrypted at all. Routes call this BEFORE touching
 * the database so a misconfigured environment is a clear 503 at the top of the
 * handler rather than a half-written row.
 */
export function isCrmCryptoConfigured(): boolean {
  return readKey(CRM_SECRET_KEY_ENV) !== null;
}

function requirePrimaryKey(): Buffer {
  const key = readKey(CRM_SECRET_KEY_ENV);
  if (!key) {
    throw new CrmCryptoUnconfiguredError(
      `${CRM_SECRET_KEY_ENV} is not set to a base64-encoded 32-byte key; refusing to store a credential`
    );
  }
  return key;
}

/**
 * Encrypt a credential object for storage. Throws when unconfigured — see the
 * header: silently degrading to plaintext is the failure mode this prevents.
 */
export function encryptCredentials(value: unknown): CredentialEnvelope {
  const key = requirePrimaryKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    v: ENVELOPE_VERSION,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ct.toString("base64"),
  };
}

export function isCredentialEnvelope(value: unknown): value is CredentialEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.v === "number" &&
    typeof candidate.iv === "string" &&
    typeof candidate.tag === "string" &&
    typeof candidate.ct === "string"
  );
}

function decryptWith(key: Buffer, envelope: CredentialEnvelope): unknown {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ct, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

/**
 * Decrypt a stored envelope, trying the primary key and then the previous one so
 * a rotation window works without a migration.
 *
 * Returns null rather than throwing on a bad envelope or a wrong key: a single
 * unreadable connection must not take down delivery for every other one, and
 * the caller records it as a normal (non-retryable) delivery failure.
 */
export function decryptCredentials(stored: unknown): unknown | null {
  if (!isCredentialEnvelope(stored) || stored.v !== ENVELOPE_VERSION) {
    return null;
  }
  const keys = [readKey(CRM_SECRET_KEY_ENV), readKey(CRM_SECRET_KEY_PREVIOUS_ENV)].filter(
    (key): key is Buffer => key !== null
  );
  for (const key of keys) {
    try {
      return decryptWith(key, stored);
    } catch {
      // Wrong key or tampered ciphertext. Try the next one; never log the
      // reason, which can quote ciphertext.
    }
  }
  return null;
}
