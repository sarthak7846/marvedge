import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CRM_SECRET_KEY_ENV,
  CRM_SECRET_KEY_PREVIOUS_ENV,
  CrmCryptoUnconfiguredError,
  decryptCredentials,
  encryptCredentials,
  isCredentialEnvelope,
  isCrmCryptoConfigured,
} from "./crypto";

// Two fixed 32-byte keys, base64. Test material only — they encrypt nothing
// outside this file.
const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = Buffer.alloc(32, 2).toString("base64");

const original: Record<string, string | undefined> = {};

function setEnv(name: string, value: string | undefined) {
  if (!(name in original)) {
    original[name] = process.env[name];
  }
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

beforeEach(() => {
  setEnv(CRM_SECRET_KEY_ENV, KEY_A);
  setEnv(CRM_SECRET_KEY_PREVIOUS_ENV, undefined);
});

afterEach(() => {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("isCrmCryptoConfigured", () => {
  it("is true for a base64 32-byte key", () => {
    expect(isCrmCryptoConfigured()).toBe(true);
  });

  it("is false when the key is absent, blank, or the wrong length", () => {
    setEnv(CRM_SECRET_KEY_ENV, undefined);
    expect(isCrmCryptoConfigured()).toBe(false);
    setEnv(CRM_SECRET_KEY_ENV, "   ");
    expect(isCrmCryptoConfigured()).toBe(false);
    setEnv(CRM_SECRET_KEY_ENV, Buffer.alloc(16, 1).toString("base64"));
    expect(isCrmCryptoConfigured()).toBe(false);
  });
});

describe("encryptCredentials", () => {
  it("round-trips an object", () => {
    const secret = { token: "pat-na1-0000-1111-2222" };
    const envelope = encryptCredentials(secret);
    expect(isCredentialEnvelope(envelope)).toBe(true);
    expect(decryptCredentials(envelope)).toEqual(secret);
  });

  it("never stores the plaintext anywhere in the envelope", () => {
    const envelope = encryptCredentials({ token: "pat-na1-supersecret" });
    expect(JSON.stringify(envelope)).not.toContain("pat-na1-supersecret");
  });

  it("produces a different ciphertext each time (fresh IV)", () => {
    const a = encryptCredentials({ token: "same" });
    const b = encryptCredentials({ token: "same" });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    expect(decryptCredentials(a)).toEqual(decryptCredentials(b));
  });

  it("FAILS LOUDLY rather than storing plaintext when the key is missing", () => {
    setEnv(CRM_SECRET_KEY_ENV, undefined);
    expect(() => encryptCredentials({ token: "x" })).toThrow(CrmCryptoUnconfiguredError);
  });
});

describe("decryptCredentials", () => {
  it("returns null for a tampered ciphertext instead of different plaintext", () => {
    const envelope = encryptCredentials({ token: "pat-na1-0000" });
    const flipped = Buffer.from(envelope.ct, "base64");
    flipped[0] ^= 0xff;
    expect(decryptCredentials({ ...envelope, ct: flipped.toString("base64") })).toBeNull();
  });

  it("returns null for a tampered auth tag", () => {
    const envelope = encryptCredentials({ token: "pat-na1-0000" });
    const tag = Buffer.from(envelope.tag, "base64");
    tag[0] ^= 0xff;
    expect(decryptCredentials({ ...envelope, tag: tag.toString("base64") })).toBeNull();
  });

  it("returns null for anything that is not an envelope", () => {
    expect(decryptCredentials(null)).toBeNull();
    expect(decryptCredentials({ token: "plaintext" })).toBeNull();
    expect(decryptCredentials("nonsense")).toBeNull();
  });

  it("returns null for an unknown envelope version", () => {
    const envelope = encryptCredentials({ token: "x" });
    expect(decryptCredentials({ ...envelope, v: 99 })).toBeNull();
  });

  it("returns null when the key has been rotated away with no previous key", () => {
    const envelope = encryptCredentials({ token: "x" });
    setEnv(CRM_SECRET_KEY_ENV, KEY_B);
    expect(decryptCredentials(envelope)).toBeNull();
  });

  it("still reads a credential encrypted under the previous key during a rotation", () => {
    const envelope = encryptCredentials({ token: "rotated" });
    setEnv(CRM_SECRET_KEY_ENV, KEY_B);
    setEnv(CRM_SECRET_KEY_PREVIOUS_ENV, KEY_A);
    expect(decryptCredentials(envelope)).toEqual({ token: "rotated" });
    // And a credential written under the NEW key reads back too, so both halves
    // of the rotation window work at once.
    expect(decryptCredentials(encryptCredentials({ token: "fresh" }))).toEqual({ token: "fresh" });
  });
});
