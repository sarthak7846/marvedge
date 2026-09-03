// The CRM delivery contract, in one place.
//
// THREE PROVIDERS, LOCKED (Overlays-Implementation-Plan.md §3 decision 19), and
// all three were chosen because they have NO procurement step:
//
//   hubspot     — a Private App token the CUSTOMER mints in their own portal.
//                 We never hold it, we never register an app, there is no OAuth
//                 install flow and no marketplace listing.
//   salesforce  — Web-to-Lead: a form-encoded POST to a public endpoint with an
//                 org id and field ids. No auth, no connected app, no review.
//   webhook     — a signed POST to any URL. The escape hatch for a customer with
//                 neither CRM, and the only one we can verify end to end.
//
// Adding a fourth provider means adding a module next to hubspot.ts and a case
// in ./index.ts — not changing this union's meaning. An OAuth-based provider is
// explicitly out of scope for v1.

export const CRM_PROVIDERS = ["hubspot", "salesforce", "webhook"] as const;

export type CrmProvider = (typeof CRM_PROVIDERS)[number];

const PROVIDER_SET: ReadonlySet<string> = new Set(CRM_PROVIDERS);

export function isCrmProvider(value: unknown): value is CrmProvider {
  return typeof value === "string" && PROVIDER_SET.has(value);
}

/** Human labels for the settings UI. Kept here so the UI cannot invent its own. */
export const CRM_PROVIDER_LABELS: Record<CrmProvider, string> = {
  hubspot: "HubSpot",
  salesforce: "Salesforce (Web-to-Lead)",
  webhook: "Signed webhook",
};

// --- Credentials -----------------------------------------------------------
// Every shape below is written to CrmConnection.credentials ENCRYPTED — see
// ./crypto.ts. None of these fields may appear in a log line, an error message
// or a route response; ./mask.ts is the only thing allowed to describe them.

export interface HubspotCredentials {
  /** Private App token, `pat-…`. Minted by the customer in their own portal. */
  token: string;
}

export interface SalesforceCredentials {
  /** The 15- or 18-character Salesforce org id (the Web-to-Lead `oid`). */
  oid: string;
  /**
   * Optional override of the Web-to-Lead endpoint. Almost every org uses the
   * default; a sandbox or a instance-pinned org does not.
   */
  endpoint?: string;
  /** Optional Web-to-Lead `retURL`. Salesforce ignores our response either way. */
  returnUrl?: string;
}

export interface WebhookCredentials {
  /** Absolute https:// URL the signed POST goes to. */
  url: string;
  /** Shared secret for the HMAC. Never leaves this process in plaintext. */
  secret: string;
}

export type CrmCredentials = HubspotCredentials | SalesforceCredentials | WebhookCredentials;

/**
 * A connection with its credentials already decrypted, ready to deliver with.
 * Deliberately NOT the Prisma row: nothing that holds a decrypted secret should
 * be shaped like something you would hand to `NextResponse.json`.
 */
export interface ResolvedConnection {
  id: string;
  provider: CrmProvider;
  credentials: CrmCredentials;
  /** Provider-specific property/field-id overrides. See each provider module. */
  fieldMap: Record<string, string>;
}

// --- Results ---------------------------------------------------------------

/**
 * The result of one delivery attempt. A DISCRIMINATED UNION rather than a thrown
 * error, because every caller has to handle failure anyway — a provider being
 * down is an expected outcome of this code, not an exception to it. Provider
 * modules must never throw across this boundary; ./index.ts converts anything
 * that escapes into `{ ok: false }`.
 */
export type DeliveryOutcome =
  | {
      ok: true;
      /**
       * Short, non-PII note for the settings UI. Salesforce's says the delivery
       * is UNCONFIRMED, because Web-to-Lead returns no confirmation body — see
       * ./salesforce.ts.
       */
      detail: string;
    }
  | {
      ok: false;
      /**
       * Whether retrying could plausibly work: 429, 5xx and network failures are
       * retryable; a rejected token or a malformed org id is not. A
       * non-retryable failure is left FAILED with a readable error rather than
       * hammering a provider that has already said no.
       */
      retryable: boolean;
      /** Already redacted by ./state.ts#safeError before it reaches the DB. */
      error: string;
    };
