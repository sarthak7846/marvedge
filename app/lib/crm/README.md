# CRM delivery (OVL — GitHub #302 §2.1)

The **outbound** half of lead capture. `POST /api/v3/leads` stores a `Lead`; this
directory forwards it to whatever the demo's owner has connected.

"Workspace" in #302 means **the `User` who owns the `Demo`** — this repo has no
`Workspace`, `Team` or membership model, and building one was explicitly out of
scope (`Overlays-Implementation-Plan.md` §3 decision 3). `CrmConnection.userId`
is the single column that would move if one ever lands.

## Providers

Three, chosen so that shipping this needed **no OAuth app, no marketplace listing
and no procurement step** (decision 19).

| Provider     | Auth                                                                                                   | Confirms delivery?                    |
| :----------- | :----------------------------------------------------------------------------------------------------- | :------------------------------------ |
| `hubspot`    | A **Private App token** the customer mints in their own portal. We never hold it and register nothing. | Yes — a 2xx from the upsert endpoint. |
| `salesforce` | **Web-to-Lead**: a form POST to a public endpoint with the org id. No auth at all.                     | **No.** See below.                    |
| `webhook`    | A per-connection shared secret, HMAC-signed.                                                           | Yes — a 2xx from the receiver.        |

An OAuth install flow, an app-marketplace listing and Salesforce connected-app
client-credentials are all **out of scope for v1** and are a separate issue.

### Salesforce delivery is unconfirmed, on purpose

Web-to-Lead answers `200` (or a redirect to `retURL`) for a valid submission, an
invalid one, a wrong org id, and a field id that does not exist. **There is no
response body to parse** — no lead id, no error list. Salesforce queues the
submission and emails the org's Web-to-Lead contact if it cannot be processed.

So a 2xx marks the delivery `DELIVERED`, and `DELIVERED` for this provider means
**accepted, not created**. The settings UI says exactly that. Do not "fix"
`salesforce.ts` by parsing the response; there is nothing in it.

Unknown Web-to-Lead field ids are **silently dropped**, which is why company size
goes into `description` by default rather than into a guessed standard field: a
wrong guess loses the data with no error anywhere.

## Credentials are encrypted at rest

`CrmConnection.credentials` is the first per-user secret this application stores.
`crypto.ts` wraps it in **AES-256-GCM** (`node:crypto`, no new dependency) and
what lands in the column is an envelope of `{ v, iv, tag, ct }`.

```
OVERLAYS_CRM_SECRET_KEY           base64 of 32 random bytes — used to ENCRYPT
OVERLAYS_CRM_SECRET_KEY_PREVIOUS  optional, accepted on DECRYPT only
```

Generate one with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**If the primary key is absent, creating a connection fails with a 503** rather
than silently writing plaintext.

**To rotate:** move the current key to `…_PREVIOUS`, put a fresh one in the
primary, deploy. Everything already stored still decrypts under the previous key;
the next save of a connection re-encrypts it under the new one. Drop `…_PREVIOUS`
once every connection has been re-saved. There is deliberately no bulk re-encrypt
job — a background task that decrypts every credential in the database is a
bigger liability than the two-key window it would save.

**No route ever returns a credential.** The settings UI shows a masked hint
(`mask.ts`) and nothing else; a stored token is write-only from the moment it is
saved.

## The signed webhook contract

Give this section to a customer building a receiver.

```
POST <your URL>
Content-Type: application/json
X-Marvedge-Timestamp: 1700000000
X-Marvedge-Signature: sha256=<lowercase hex>
```

```
signature = HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
```

Three rules:

1. **Verify against the raw request body**, not a re-serialisation of the parsed
   JSON — key order and whitespace differ and every signature would fail.
2. **Compare in constant time.**
3. **Reject a timestamp outside a few minutes of your own clock.** The timestamp
   is inside the signed string so a captured request cannot be replayed forever,
   but the freshness window is yours to enforce.

A worked example, which is also the fixture in `signature.test.ts`:

```sh
printf '%s' '1700000000.{"event":"lead.created","id":"lead_123"}' \
  | openssl dgst -sha256 -hmac 'whsec_marvedge_test' -hex
# 83247e8d9fc4e51551f289a4b351cb2a003d068811987c9701464c093eb1a35a
```

Body shape (fields may be **added**; renaming or removing one is a breaking
change):

```json
{
  "version": 1,
  "event": "lead.created",
  "leadId": "…",
  "sentAt": "2026-08-28T10:00:00.000Z",
  "data": {
    "email": "ada@acme.com",
    "firstName": "Ada",
    "lastName": "Lovelace",
    "fullName": "Ada Lovelace",
    "company": "acme.com",
    "companySize": "51-200",
    "referrer": null,
    "demoId": "…",
    "demoTitle": "…",
    "demoUrl": "https://marvedge.com/share/…",
    "submittedAt": "2026-08-28T09:30:00.000Z",
    "consentText": "…",
    "consentAt": "2026-08-28T09:29:58.000Z",
    "source": "Marvedge"
  }
}
```

## The name-splitting rule

`normalize.ts` splits the single `name` field the gate collects as **first token
= first name, everything after it = last name**:

| Input              | firstName | lastName       |
| :----------------- | :-------- | :------------- |
| `""`               | `""`      | `""`           |
| `Ada`              | `Ada`     | `""`           |
| `Ada Lovelace`     | `Ada`     | `Lovelace`     |
| `Jan van der Berg` | `Jan`     | `van der Berg` |

Not "last token is the surname" — that rule turns `María del Carmen García` into
a surname of `García` and is wrong in a way that is hard to unpick later.

Salesforce **requires** `last_name`, so `salesforce.ts` falls back to the whole
name, then to the email local part, then to a literal. It never fabricates one.

`company` is derived from the email domain, because the gate does not ask for a
company and Web-to-Lead requires one.

## Delivery, retries and idempotence

No queue (decision 10). A `LeadDelivery` row **is** the queue:

- `POST /api/v3/leads` writes the `Lead`, then `after(() => deliverLead(leadId))`
  — the same shape as `dispatchVideoJob()` in `app/api/jobs/create/route.ts`.
- One `LeadDelivery` per `(leadId, connectionId)`, enforced by a unique index.
- `runDelivery()` retries **only retryable** outcomes (429, 5xx, network) with a
  short bounded backoff, because this runs inside a live serverless invocation.
- Everything else is left `FAILED` with a readable `lastError`. `attempts`
  accumulates across every HTTP request, never resets.
- `DELIVERED` is terminal. **That is what makes retry idempotent**: calling
  `POST /api/v3/leads/retry` twice cannot deliver a lead twice.

`OVERLAYS_CRM_ENABLED` gates the whole outbound path. **With it off, leads are
still captured and stored and no delivery rows are created at all** — so turning
it on later starts from a clean ledger rather than a backlog.

Plan gating (decision 14) is re-resolved server-side from `User.plan` on every
delivery: an owner who downgrades stops forwarding at the same moment they stop
collecting.

## PII

`LeadDelivery.lastError` is rendered in the owner's settings page, and provider
error bodies quote the payload back at you — HubSpot's conflict and validation
errors name the offending value, and that value is a viewer's name or address.
`state.ts#safeError()` strips anything shaped like an email address and truncates
before anything reaches the database. `app/api/v3/leads/route.ts` holds the same
line at the inbound end; hold it here.

Nothing in this directory logs a lead field or a credential. Every log line is a
literal plus ids.

## Endpoints

| Route                                    | Who                   | What                                                                                |
| :--------------------------------------- | :-------------------- | :---------------------------------------------------------------------------------- |
| `GET/POST /api/crm/connections`          | Owner, PRO/ENTERPRISE | List (masked) / create                                                              |
| `PATCH/DELETE /api/crm/connections/[id]` | Owner                 | Update (credentials write-only) / delete                                            |
| `POST /api/crm/connections/[id]/test`    | Owner                 | Sends a **synthetic** lead through the **real** path and reports the **real** error |
| `POST /api/crm/connections/[id]/retry`   | Owner                 | Resend this connection's `FAILED` deliveries                                        |
| `POST /api/v3/leads/retry`               | Owner                 | Resend all of the caller's `FAILED` deliveries                                      |

`/api/v3/leads/retry` sits in the otherwise-public `/api/v3` namespace because
#302 names the path; it is the one endpoint under that prefix that **requires a
session**. There is no scheduler in this PR — what calls it on a timer is a
separate decision.
