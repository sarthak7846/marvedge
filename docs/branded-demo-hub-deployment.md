# Branded Demo Hub (BDH) — deployment runbook

The hub code is complete, but custom domains are an infrastructure feature: the
application cannot provision DNS, buy a Cloudflare add-on, or register hostnames
with the hosting platform on its own. This is everything that has to exist
outside the repo before BDH works end to end, in the order it has to happen.

Nothing here is optional for custom domains. Marvedge-subdomain hubs
(`acme.marvedge.com`) need only steps 1, 2 and 5.

---

## 1. Apply the database migration

The feature adds the `HubSettings` table plus four `Demo` columns. The original
PR changed `schema.prisma` without generating a migration, so a database built
from `prisma migrate deploy` has neither.

```bash
npx prisma migrate deploy
```

The migration (`20260729000000_add_hub_settings_and_demo_metadata`) is written
idempotently, so it is safe to run against a database that already has these
objects from an earlier `prisma db push`.

**Verify:** `SELECT to_regclass('"HubSettings"');` returns non-null, and
`\d "Demo"` shows `tags`, `integrations`, `userRoles`, `featured`.

---

## 2. Set the domain environment variables

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `marvedge.com` | Apex the app is served from. **Must match production exactly** — any host that is not this (or a dev/preview host) is treated as a customer hub. |
| `NEXT_PUBLIC_HUB_ROOT_DOMAIN` | blank, or a separate apex | Leave blank to serve hubs as subdomains of the root domain. |
| `NEXT_PUBLIC_HUB_CNAME_TARGET` | `hub-ingress.marvedge.io` | What customers point their CNAME at. Shown verbatim in the settings UI. |

> These are `NEXT_PUBLIC_*` and are **inlined at build time**. Changing them
> requires a redeploy, not just an env update.

---

## 3. Wildcard DNS + hosting platform registration

Two separate things, both required. This is the step most likely to be missed,
because DNS can look correct while the origin still refuses the request.

**a. DNS.** Add a wildcard record for hub subdomains:

```
*.marvedge.com    CNAME    <hosting origin>
```

**b. Register the wildcard with the host.** Vercel serves a request only if the
hostname is attached to a project — an unregistered `Host` header gets a
platform 404 that never reaches our middleware. Add `*.marvedge.com` as a domain
on the Vercel project.

For **customer** domains (`demos.mycompany.com`) the traffic arrives via
Cloudflare (step 4) with the customer's `Host` header preserved, so the origin
must accept arbitrary hostnames. Either:

- attach a wildcard domain to the project and let Cloudflare proxy to it, or
- call the Vercel Domains API to attach each custom hostname when it is
  registered.

The application currently does **neither** — it registers the hostname with
Cloudflare only. Whichever route is chosen has to be set up here, and if the
API route is chosen it also needs building.

**Verify:** `curl -I https://anything.marvedge.com` returns a Marvedge response
(a hub 404 page is fine — a *platform* 404 is not).

---

## 4. Cloudflare SSL for SaaS

1. **Enable Cloudflare for SaaS** on the zone. It is a paid add-on billed per
   custom hostname; the feature cannot work until it is on the account.
2. **Create the ingress record.** `hub-ingress.marvedge.io` must exist and
   resolve to the origin — it is the CNAME target every customer is told to use.
3. **Set a fallback origin** on the zone. Without one, verified custom hostnames
   still will not route.
4. **Set the API credentials:**

   ```
   CF_ZONE_ID=...
   CF_AUTH_EMAIL=...
   CF_AUTH_KEY=...
   ```

   Per PRD §4.3 these are the Global API Key headers. That key grants full
   account access — **recommend migrating to a scoped API token** limited to
   `Zone → SSL and Certificates → Edit` on this zone alone.

If these are unset, custom domains are mocked in development and **rejected in
production**. They are never silently faked — an earlier version reported
domains as active with nothing provisioned.

**Verify:** save a custom domain in Settings → Branding and confirm the hostname
appears under Cloudflare → SSL/TLS → Custom Hostnames.

---

## 5. Cron for asynchronous verification

PRD §4.3 requires ownership/SSL verification to run as a backend process rather
than depending on the user refreshing the page. `vercel.json` schedules
`/api/cron/hub-domains` every 15 minutes to poll pending certificates and sweep
for orphaned hostnames.

> **Requires a Vercel Pro plan.** Hobby projects are limited to cron jobs that
> run at most once per day, and the `*/15 * * * *` schedule will not be
> accepted. On Hobby, either drop to a daily schedule (certificates then take up
> to a day to flip to active on their own) or trigger the route from an external
> scheduler with the same `Authorization: Bearer $CRON_SECRET` header.

```
CRON_SECRET=<random string>
```

Vercel sends this as `Authorization: Bearer $CRON_SECRET`. **Required in
production** — the route refuses to run without it rather than exposing an open
maintenance endpoint.

The orphan sweep is **report-only by default**: it logs hostnames that still
route to us but have no hub behind them. Deleting from a zone is irreversible,
so removal is opt-in:

```
BDH_RECONCILE_DELETE=true
```

Only enable this once you have confirmed the zone contains nothing but Marvedge
hub hostnames.

**Verify:** `curl -H "Authorization: Bearer $CRON_SECRET" https://marvedge.com/api/cron/hub-domains`
returns `{"success":true,...}`.

---

## 6. Kill switches

BDH is opt-**out**, unlike AVS and WTM — it is already serving traffic, so an
unset variable keeps it enabled.

| Variable | Effect when `"false"` |
| --- | --- |
| `BDH_ENABLED` | Hub settings/domain APIs return 404, the cron no-ops, and the public `/hub/...` pages 404 |
| `NEXT_PUBLIC_BDH_ENABLED` | Middleware stops hub host routing (every host serves the normal app) and the Branding tab is hidden from Settings |

Set **both** to disable the feature completely. `BDH_ENABLED` is server-only and
takes effect on restart; `NEXT_PUBLIC_BDH_ENABLED` is inlined at build time and
needs a redeploy.

Use these to disable the feature without a revert if hub routing misbehaves in
production.

---

## Plan gating

- **The hub and its Marvedge subdomain are free on every plan** — logo, colours,
  search, and collections included.
- **Mapping your own domain requires PRO or ENTERPRISE.** It is the white-label
  half and the only part with a per-hostname cost to us. This mirrors WTM, where
  capture is free and the customizable watermark is paid.

An existing custom domain keeps working if a user downgrades; only *changing* it
is gated. Automatic deprovisioning on downgrade is deliberately not implemented
— pulling a live customer domain is a product decision, not an engineering one.

---

## Known gaps

Not implemented, and each needs a product decision rather than more code:

- **Demo thumbnails.** There is no thumbnail field on the `Demo` model, so every
  hub card is an identical placeholder. Real thumbnails need a schema column and
  poster-frame generation in the export pipeline.
- **Hub curation lives in the editor's Save dialog.** Tags, integrations, roles
  and "Featured" are edited there (reopening it on a saved demo updates them in
  place). There is no bulk curation view on the demo list; that is a UI addition,
  not a blocker.
- **"Powered by Marvedge" footer** appears on every hub regardless of plan.
- **Downgrade deprovisioning** — see above.
- **Vercel hostname registration for custom domains** — see step 3b.
