// The only thing allowed to describe a stored credential.
//
// No route returns `credentials`. The settings page needs to show the owner
// WHICH connection they are looking at — "is that the token I rotated last
// week?" — and that is what these hints are for: enough to recognise, never
// enough to use.
//
// Pure and node-free so it can be unit-tested and, if it ever needs to be,
// rendered on the client from an already-masked payload.

import { CRM_PROVIDER_LABELS } from "./types";
import type { CrmCredentials, CrmProvider } from "./types";

/** What a connection looks like in an API response. No secret material. */
export interface MaskedConnection {
  id: string;
  provider: CrmProvider;
  providerLabel: string;
  enabled: boolean;
  /** One line the owner can recognise the connection by. Never reversible. */
  hint: string;
  lastOkAt: string | null;
  lastError: string | null;
  createdAt: string;
  fieldMap: Record<string, string>;
}

/**
 * Last four characters, with a fixed-width prefix.
 *
 * FIXED WIDTH MATTERS: `"•".repeat(secret.length)` leaks the length of the
 * secret, which is a real (if small) hint about which kind of token it is.
 */
export function maskSecret(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "—";
  }
  const tail = value.slice(-4);
  return value.length <= 4 ? "••••" : `••••${tail}`;
}

/**
 * A recognisable, non-reversible description of a connection's credentials.
 * Returns a placeholder rather than throwing when the envelope could not be
 * decrypted — a connection whose key has been rotated away still has to render.
 */
export function credentialHint(provider: CrmProvider, credentials: unknown): string {
  if (typeof credentials !== "object" || credentials === null) {
    return "Credentials unavailable";
  }
  const record = credentials as Record<string, unknown>;

  switch (provider) {
    case "hubspot":
      return `Private App token ${maskSecret(record.token)}`;
    case "salesforce": {
      const oid = typeof record.oid === "string" ? record.oid : "";
      return oid ? `Org id ${oid}` : "Org id not set";
    }
    case "webhook": {
      const url = typeof record.url === "string" ? record.url : "";
      return url ? `${hostOf(url)} · secret ${maskSecret(record.secret)}` : "URL not set";
    }
    default:
      return "Credentials unavailable";
  }
}

/**
 * The Salesforce org id is NOT a secret — it appears in the HTML of every
 * Web-to-Lead form the customer has ever published — so it is shown in full.
 * Masking it would make the connection unidentifiable for no gain.
 */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid URL";
  }
}

export function maskConnection(input: {
  id: string;
  provider: CrmProvider;
  enabled: boolean;
  credentials: CrmCredentials | null;
  fieldMap: Record<string, string>;
  lastOkAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}): MaskedConnection {
  return {
    id: input.id,
    provider: input.provider,
    providerLabel: CRM_PROVIDER_LABELS[input.provider],
    enabled: input.enabled,
    hint: credentialHint(input.provider, input.credentials),
    lastOkAt: input.lastOkAt ? input.lastOkAt.toISOString() : null,
    lastError: input.lastError,
    createdAt: input.createdAt.toISOString(),
    fieldMap: input.fieldMap,
  };
}
