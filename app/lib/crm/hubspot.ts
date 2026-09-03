// HubSpot — create-or-update a contact with a Private App token.
//
// WHY A PRIVATE APP AND NOT OAUTH: the token is minted by the CUSTOMER in their
// own portal (Settings → Integrations → Private Apps) and pasted into their
// Marvedge settings. We register nothing, we list nothing on the marketplace,
// and there is no install flow to review. The cost is that the customer does one
// minute of clicking; the benefit is that this PR has no external lead time and
// we never hold an app secret that unlocks every customer at once. Locked
// decision 19 — OAuth is a later upgrade, not a v1 requirement.
//
// CREATE-OR-UPDATE, not create. A viewer who fills the gate on two different
// demos is one person, and the second submission must not create a second
// contact. `POST /crm/v3/objects/contacts/batch/upsert` with
// `idProperty: "email"` is HubSpot's documented single-call upsert; the plain
// object POST answers 409 on an existing email and would need a second round
// trip to resolve the id.
//
// PII: this module SENDS lead data, which is its whole job. It must not LOG any
// of it, and the error strings it returns are truncated response snippets that
// state.ts#safeError strips addresses out of before they reach the database.

import { sourceDescription } from "./normalize";
import type { NormalizedContact } from "./normalize";
import type { DeliveryOutcome, HubspotCredentials } from "./types";

export const HUBSPOT_UPSERT_URL = "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert";

export const HUBSPOT_TIMEOUT_MS = 10_000;

/**
 * Where the company-size bucket goes by default.
 *
 * `numemployees` is a STANDARD HubSpot contact property ("Number of Employees",
 * in the Company Information group), so this works in a fresh portal with no
 * setup. It is a string property in the default configuration and the bucket
 * ("51-200") is written verbatim.
 *
 * A portal that has redefined it as a number, or that keeps company size on a
 * custom property, sets `fieldMap.companySize` to the internal name of the
 * property it wants instead. There is no automatic detection: guessing at a
 * customer's property schema is how you write "51-200" into a numeric field and
 * get a validation error nobody can explain.
 */
export const HUBSPOT_DEFAULT_COMPANY_SIZE_PROPERTY = "numemployees";

/**
 * Map a contact onto HubSpot properties.
 *
 * PURE, so the mapping is testable without a token. `fieldMap` may override the
 * property NAME for company size and for the notes field; it cannot rename
 * email/firstname/lastname, which are the standard properties every portal has.
 */
export function toHubspotProperties(
  contact: NormalizedContact,
  fieldMap: Record<string, string> = {}
): Record<string, string> {
  const properties: Record<string, string> = {
    email: contact.email,
  };

  if (contact.firstName) {
    properties.firstname = contact.firstName;
  }
  if (contact.lastName) {
    properties.lastname = contact.lastName;
  }
  if (contact.company) {
    properties.company = contact.company;
  }
  if (contact.companySize) {
    const property = fieldMap.companySize || HUBSPOT_DEFAULT_COMPANY_SIZE_PROPERTY;
    properties[property] = contact.companySize;
  }

  // `hs_content_membership_notes` is not a safe default to write to, so the
  // source summary only goes out when the owner has named a property for it.
  const notesProperty = fieldMap.notes;
  if (notesProperty) {
    properties[notesProperty] = sourceDescription(contact);
  }

  const sourceProperty = fieldMap.source;
  if (sourceProperty) {
    properties[sourceProperty] = contact.source;
  }

  return properties;
}

export async function deliverToHubspot(
  credentials: HubspotCredentials,
  contact: NormalizedContact,
  fieldMap: Record<string, string> = {}
): Promise<DeliveryOutcome> {
  const body = JSON.stringify({
    inputs: [
      {
        idProperty: "email",
        id: contact.email,
        properties: toHubspotProperties(contact, fieldMap),
      },
    ],
  });

  let response: Response;
  try {
    response = await fetch(HUBSPOT_UPSERT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(HUBSPOT_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      error: `HubSpot request failed: ${error instanceof Error ? error.message : "network error"}`,
    };
  }

  if (response.ok) {
    return { ok: true, detail: "Contact upserted in HubSpot" };
  }

  const snippet = (await readSnippet(response)).slice(0, 200);

  // 401/403 is a bad or under-scoped token; retrying cannot fix it and the owner
  // needs to be told plainly, because "check your token scopes" is the single
  // most common HubSpot setup failure.
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      retryable: false,
      error: `HubSpot rejected the token (${response.status}). Check the Private App token and that it has the crm.objects.contacts.write scope.`,
    };
  }

  return {
    ok: false,
    retryable: response.status === 429 || response.status >= 500,
    error: `HubSpot responded ${response.status}${snippet ? `: ${snippet}` : ""}`,
  };
}

async function readSnippet(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
