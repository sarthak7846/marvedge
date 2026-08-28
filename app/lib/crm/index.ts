// The provider boundary: one function in, a discriminated result out.
//
// `deliver()` NEVER THROWS. Every caller of this module is a delivery loop that
// has to keep going for the other connections, and turning a provider outage
// into an exception would mean each of them writing the same try/catch. Anything
// that escapes a provider module is caught here and converted.
//
// HTTP lives in the provider modules; the MAPPING lives in ./normalize.ts and
// the per-provider `to…Fields`/`to…Properties` functions, which are pure and
// tested. That split is deliberate: mapping is what silently corrupts data and
// is worth testing, HTTP is what fails loudly and is worth mocking.

import { deliverToHubspot } from "./hubspot";
import { deliverToSalesforce } from "./salesforce";
import { MAX_ATTEMPTS_PER_RUN, RETRY_DELAYS_MS, safeError } from "./state";
import { deliverToWebhook } from "./webhook";
import type { NormalizedContact } from "./normalize";
import type {
  DeliveryOutcome,
  HubspotCredentials,
  ResolvedConnection,
  SalesforceCredentials,
  WebhookCredentials,
} from "./types";

/** One attempt against one provider. */
export async function deliver(
  connection: ResolvedConnection,
  leadId: string,
  contact: NormalizedContact
): Promise<DeliveryOutcome> {
  try {
    switch (connection.provider) {
      case "hubspot":
        return await deliverToHubspot(
          connection.credentials as HubspotCredentials,
          contact,
          connection.fieldMap
        );
      case "salesforce":
        return await deliverToSalesforce(
          connection.credentials as SalesforceCredentials,
          contact,
          connection.fieldMap
        );
      case "webhook":
        return await deliverToWebhook(
          connection.credentials as WebhookCredentials,
          leadId,
          contact
        );
      default:
        return { ok: false, retryable: false, error: "Unknown CRM provider" };
    }
  } catch (error) {
    // A provider module is not supposed to throw. If one does, it is a bug in
    // ours rather than a rejection from theirs, so it is retryable.
    return { ok: false, retryable: true, error: safeError(error) };
  }
}

export interface DeliveryRun {
  outcome: DeliveryOutcome;
  /** HTTP attempts actually consumed, for LeadDelivery.attempts. */
  attempts: number;
}

/**
 * Attempt one delivery with a short bounded backoff.
 *
 * ONLY RETRYABLE OUTCOMES ARE RETRIED. A 401 from HubSpot means the token is
 * wrong, and repeating it three times produces the same 401, three times the
 * latency and one extra reason for HubSpot to rate-limit the customer's portal.
 *
 * The whole run is bounded by RETRY_DELAYS_MS because it happens inside Next's
 * `after()` — the response has already been sent, but the invocation is still
 * live and still has a wall-clock ceiling. Anything that needs longer than this
 * is what the FAILED row and POST /api/v3/leads/retry exist for.
 */
export async function runDelivery(
  connection: ResolvedConnection,
  leadId: string,
  contact: NormalizedContact,
  sleep: (ms: number) => Promise<void> = defaultSleep
): Promise<DeliveryRun> {
  let outcome: DeliveryOutcome = { ok: false, retryable: true, error: "No attempt was made" };

  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_RUN; attempt += 1) {
    outcome = await deliver(connection, leadId, contact);
    if (outcome.ok || !outcome.retryable) {
      return { outcome, attempts: attempt + 1 };
    }
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined) {
      break;
    }
    await sleep(delay);
  }

  return { outcome, attempts: MAX_ATTEMPTS_PER_RUN };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { deliverToHubspot } from "./hubspot";
export { deliverToSalesforce } from "./salesforce";
export { deliverToWebhook } from "./webhook";
export { normalizeLead, splitName } from "./normalize";
export type { NormalizedContact } from "./normalize";
export { nextDeliveryState, safeError, shouldAttempt } from "./state";
export type { DeliveryState, DeliveryStatus } from "./state";
export { signWebhookPayload, verifyWebhookSignature } from "./signature";
export { maskConnection, credentialHint } from "./mask";
export type { MaskedConnection } from "./mask";
export { parseCredentials, resolveConnection, validateWebhookUrl } from "./connection";
export { CRM_PROVIDERS, CRM_PROVIDER_LABELS, isCrmProvider } from "./types";
export type { CrmProvider, DeliveryOutcome, ResolvedConnection } from "./types";
