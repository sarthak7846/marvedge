This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## AI Script, Voiceover & Audio Sync (AVS)

AVS turns a recorded demo into an AI-voiced, time-synced, subtitled video. It is
**PRO/ENTERPRISE only** and ships behind a feature flag, so it is completely
invisible and no-op when the flag is off — existing (non-AVS) demos and exports
are never affected.

### The flow

Open a saved demo in the editor, switch to the **AI Voice** sidebar tab, and use
**Generate AI Voiceover Demo** to run the full pipeline in one click:

1. **Steps** — the demo is auto-sliced into steps from the Chrome-extension
   click-capture timestamps (falling back to one full-length step if there are no
   clicks). Split / merge / adjust boundaries in the panel timeline.
2. **AI script** — per-step narration is seeded from the Deepgram transcript and
   rewritten into a tone (Sales / Onboarding / Support / Marketing) via OpenAI.
3. **Voiceover** — the script is synthesized into one continuous MP3 with
   Deepgram Aura TTS in the Cloud Run worker, recording each step's timing.
4. **Captions** — the voiceover is transcribed and stabilized into flicker-free
   captions (also exportable as `.vtt`).
5. **Time-alignment** — a pre-pass freeze-frames video where the audio is longer
   than its step and pads silence where it is shorter, muxing the voiceover into
   one aligned source MP4.
6. **Export** — the aligned source (AI voice already muxed in) plus the stabilized
   captions are fed into the **existing** export route, so the final render carries
   the AI voice, freeze-frame timing, and clean captions.

Every stage persists to `Demo.editing.avs` via the normal autosave (there is no
DB migration — all AVS state lives in the existing `editing` JSON). Each stage
also has its own editor in the panel for fine-tuning before or after a full run.

### Environment variables

AVS keys are **server-side only** — never expose them with a `NEXT_PUBLIC_`
prefix.

| Variable                  | Where                     | Purpose                                                               |
| :------------------------ | :------------------------ | :-------------------------------------------------------------------- |
| `AVS_ENABLED`             | Next app (server)         | Master switch for the AVS server routes. Set to `true` to enable.     |
| `NEXT_PUBLIC_AVS_ENABLED` | Next app (client)         | Shows the "AI Voice" sidebar panel. Set to `true` to enable.          |
| `OPENAI_API_KEY`          | Next app (server)         | OpenAI script tone rewrite (`/api/avs/script`).                       |
| `GCP_VIDEO_WORKER_URL`    | Next app (server)         | Reaches the Cloud Run worker for Aura TTS, subtitles, and alignment.  |
| `DEEPGRAM_API_KEY`        | **Cloud Run worker only** | Deepgram transcription + Aura TTS. The Next app never holds this key. |

To enable AVS for a staging/QA environment, set both `AVS_ENABLED=true` and
`NEXT_PUBLIC_AVS_ENABLED=true` there (plus `OPENAI_API_KEY` and
`GCP_VIDEO_WORKER_URL`), and make sure the worker has `DEEPGRAM_API_KEY`. Leave
all of these blank/unset in production until the feature is signed off. See
`.env.example` for the full list.

## Watermarking & Camera Bubble (WTM)

WTM brands an exported demo: a corner watermark on every export, and an optional
circular webcam bubble composited into the video. It ships behind a feature flag
and is a complete no-op when the flag is off — including the free-tier
watermark, so existing exports are unchanged until enablement.

### Plan behavior

|               | FREE / anonymous                                                                    | PRO / ENTERPRISE                                                   |
| :------------ | :---------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| Watermark     | Forced Marvedge badge (bottom-right, 55% opacity). Cannot be customized or removed. | Custom PNG, adjustable opacity + corner, or switched off entirely. |
| Camera bubble | Recorded and configurable, but not composited into the export.                      | Composited into the export.                                        |

Recording the camera is free for everyone — creation features are not gated. The
gate sits at export: `app/api/jobs/create/route.ts` re-resolves the watermark
from the user's real plan (so a FREE user gets the badge no matter what the
client sends), and `/api/wtm/composite` rejects a non-PRO bubble.

### The flow

1. **Record** — the recorder offers a camera toggle with a live preview. With it
   on, a second `MediaRecorder` captures the camera **video only** (the screen
   recording already carries mic/tab audio, so muxing the camera too would
   double it), uploads the clip, and stores its URL.
2. **Arrange** — the editor's **Branding** sidebar tab places and sizes both
   overlays, and the editor preview draws them over the video card so what you
   arrange is what gets baked in. Preview and export share their corner math and
   margins via `app/lib/wtm/geometry.ts`.
3. **Composite (pre-pass)** — on export, if a camera clip exists,
   `/api/wtm/composite` runs the Cloud Run worker's `/wtm-composite` first: it
   normalizes both inputs to 30 FPS, center-square crops the camera (so a
   non-16:9 webcam is cropped, not squished), applies a circular alpha mask, and
   overlays it in the chosen corner, producing **one** composited MP4. Original
   audio is passed through untouched.
4. **Export** — that composited MP4 becomes the source for the existing chunked
   export, which applies trim / zoom / background / text / subtitles and the
   watermark on top. The pre-pass never fails an export: no clip, a non-PRO
   user, or a worker error all fall back to the original source with a toast.

All WTM state persists to `Demo.editing.wtm` (`watermark` + `webcam`) through the
normal autosave — there is no DB migration.

### Environment variables

| Variable                  | Where                     | Purpose                                                                                             |
| :------------------------ | :------------------------ | :-------------------------------------------------------------------------------------------------- |
| `WTM_ENABLED`             | Next app (server)         | Master switch for the watermark render/plan logic and the composite route. Set to `true` to enable. |
| `NEXT_PUBLIC_WTM_ENABLED` | Next app (client)         | Shows the "Branding" sidebar panel and the preview overlays. Set to `true` to enable.               |
| `GCP_VIDEO_WORKER_URL`    | Next app (server)         | Reaches the Cloud Run worker for the compositing pre-pass.                                          |
| `WTM_COMPOSITE_FPS`       | **Cloud Run worker only** | Frame rate both inputs are normalized to. Optional, defaults to `30`.                               |
| `WTM_COMPOSITE_PREFIX`    | **Cloud Run worker only** | GCS prefix for composited sources. Optional, defaults to `wtm-composite/`.                          |

WTM needs no new vendor or API key — it is pure ffmpeg on the existing GCS /
Cloud Run worker. Both flags are enabled on staging/QA; leave them blank in
production until the feature is signed off. See `.env.example` for the full list.

## Shareable-Link QR Codes (QR)

Every share link can also be a **branded QR code**: deep-purple rounded modules on
white with the Marvedge mark at the centre, offered wherever a share URL already
exists. It is purely derived — the QR renders a link that already exists, mints
nothing, writes nothing, and never touches the export path. No DB migration, no
new vendor, no new API key. The only dependency is `qrcode-generator`, a
zero-dependency matrix library.

### Where it shows up

| Surface                                  | What appears                                                                                                                |
| :--------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `app/components/ExportResultModal.tsx`   | The QR, shown as soon as a `shareUrl` exists — the "after the demo is generated" moment.                                    |
| `app/components/ShareModal.tsx`          | The same QR, collapsed behind a "Show QR code" toggle so the modal does not balloon.                                        |
| `app/hub/[domain]/share/[slug]/page.tsx` | A "scan to open" card on the customer hub share page, encoding **the customer's own domain**.                               |
| `GET /api/qr?url=…&size=…`               | A cacheable `image/svg+xml` render, for the places a React component cannot reach (an `<img>` in an email, a slide, a PDF). |

The demos list (`app/(signed)/demos/`) has **no share affordance at all** today,
even though `app/api/demos/[id]/share/route.ts` exists and works. That gap is
noted rather than filled here — a QR belongs next to a share button, and building
the share flow is its own change.

### `GET /api/qr`

Returns SVG with `Cache-Control: public, max-age=31536000, immutable` — the output
is a pure function of the query. Unauthenticated, because it renders a link that
is already public, and `size` is the only knob besides `url`. There is
deliberately **no `style` param**.

The `url` must resolve to a Marvedge-owned share URL or the route answers `400`.
Allowed: the `NEXT_PUBLIC_APP_URL` origin, the root domain plus `www` and any hub
subdomain, the host the request itself arrived on (which is how a custom hub
domain validates, without a DB lookup), and loopback off production. Everything
else is refused, including look-alikes such as `marvedge.com.evil.example` and
credential tricks such as `https://marvedge.com@evil.example/`. The path must also
look like a share path, so the endpoint cannot brand `/auth/signin`.

Two things about that check are easy to get wrong:

- **`sanitizeQrOptions()` / `toQrTargetUrl()` are not a host check.** They validate
  scheme, length and shape only, and deliberately not the host — the engine is
  isomorphic and cannot know the request origin. The allowlist in
  `app/lib/share/qrTarget.ts` layers on top of them. Rendering an arbitrary URL
  inside a Marvedge-branded QR is a phishing primitive; there is no "allow any
  URL" escape hatch and adding one re-opens it.
- **The route never queries the database.** A public unauthenticated endpoint that
  404s on unknown slugs is an oracle for which share ids exist, so validation is
  by URL shape only.

**Custom domains.** `app/api/demos/[id]/share/route.ts` builds share URLs as
`NEXT_PUBLIC_APP_URL || request.nextUrl.origin`, which is right for a creator
copying a link on marvedge.com. It is wrong on a customer hub: a visitor reading
`https://demos.acme.com/share/abc` is served by `/hub/acme/share/abc` through the
`middleware.ts` rewrite, and a QR encoding `marvedge.com/share/abc` would walk them
off the customer's white-labeled domain mid-scan. Hub pages therefore resolve the
origin from the **request host** and ignore `NEXT_PUBLIC_APP_URL` — see
`hubShareUrl()` in `app/lib/share/qrTarget.ts`, which carries the rule and its
tests.

### Scan attribution

The URL _encoded in the QR_ carries `?src=qr`; the copy-to-clipboard link stays
clean, so a pasted link is never miscounted as a scan. The decoration lives in one
helper (`withQrSource()`), applied at the two places a QR is produced — the client
renderer and `/api/qr` — and is read back by
`app/share/[slug]/hooks/useViewTracking.ts`, which passes `source: "qr"` to
`/api/views`.

**That source is logged, not stored.** `model View` has no column for it and there
is no events table, so persisting it would need a `prisma/schema.prisma` change and
a migration, which this feature deliberately does not carry. Scan volume is
visible in the server logs today (`[Views] QR scan: …`), and the client already
sends the field — adding the column later is a one-line change in
`app/api/views/route.ts`, with history from that day forward.

### One style, on purpose

`QrStyle` is `"badge" | "branded"` and **only `badge` is surfaced**. There is no
style toggle, no style prop and no style query param, and adding one is a product
decision rather than a UI improvement. `branded` (the mark drawn large and tinted
behind the modules) stays in the engine and stays covered by `qr.test.ts`, but
nothing offers it. The reason is _not_ scannability — both were phone-verified at
200 px. Badge won on **mark legibility**: it draws the mark solid `#2D1F61`, while
`branded`'s 22% tint reads as a smudge once the URL pushes the code past ~40
modules. The point of the feature is that every scan carries the mark.

### Scannability is the acceptance criterion

These invariants are enforced in `app/lib/qr/` and covered by its tests. They are
not style preferences — break one and codes silently stop scanning for some
fraction of cameras, which no visual review catches:

| Rule                                             | Why                                                                                  |
| :----------------------------------------------- | :----------------------------------------------------------------------------------- |
| **ECC level `H`** (30% recovery), always         | Buys the error budget the logo knockout and rounded modules spend.                   |
| **Quiet zone ≥ 4 modules**                       | Scanners fail without it far more often than for any styling reason.                 |
| **Logo occlusion ≤ 25% linear** (≈6% of area)    | Well inside the `H` budget, with room left for print and camera noise.               |
| **Finder patterns stay solid dark-on-light**     | Rounding their corners is safe; tinting, occluding, or backing them with art is not. |
| **Timing patterns (row/col 6) never occluded**   | The knockout must stay centred and small enough never to reach them.                 |
| **Contrast ≥ 4:1** between module and light cell | Checked in code (`assertQrContrast`), not by eyeballing.                             |

If a change makes an assertion in `app/lib/qr/qr.test.ts` fail, the change is
wrong — do not edit the test to match.

### The brand mark asset

`public/qr/marvedge-mark.png` is **generated, not hand-edited**. `scripts/qr/make-mark.mjs`
derives it from the source logo at build time: it chroma-keys the flat periwinkle
field out, recolours the mark to `#2D1F61`, trims and re-centres it, and writes
both the PNG and `app/lib/qr/mark.ts`, which inlines the same bytes as a `data:`
URI. The engine uses the constant, never the file path — a remote `src` would taint
the canvas the client-side PNG export draws into and `toBlob()` would throw. To
change the mark, edit the script and re-run it.

> `dither: 0` in that script is load-bearing. sharp's PNG palette encoder dithers
> by default, which scatters off-hue pixels through what should be one flat colour
> and quietly breaks the "art and modules share one colour" invariant.

### If a QR won't scan

1. **Check the size it is rendered at.** Below roughly 4 px per module a camera
   cannot resolve it. A long URL means a higher QR version, more modules, and a
   larger minimum size — shorten the URL before shrinking the code.
2. **Check the quiet zone survived.** A CSS `overflow: hidden`, a tight flex
   container, or a crop that clips the white border is the single most common
   cause. The engine emits it; a layout can still cut it off.
3. **Check contrast end to end.** The engine guarantees ≥ 4:1 for the colours it is
   given, but a parent with a coloured or textured background showing through a
   transparent container defeats it. The QR needs an opaque light ground.
4. **Check nothing was overlaid on it.** A badge, a caption, or a hover effect on
   top of the finder or timing patterns breaks decoding even when it looks fine.
5. **Check the target URL actually resolves.** A QR for an unshared or deleted demo
   scans perfectly and then lands on a 404 — `/api/qr` validates URL _shape_, never
   existence, by design.
6. **Only then suspect the engine.** Run `npm test`; the QR suite rasterizes and
   decodes real codes across versions.

### Environment variables

| Variable                       | Where                      | Purpose                                                                                                            |
| :----------------------------- | :------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SHARE_QR_ENABLED` | Next app (client + server) | Kill-switch for the whole QR surface. **Defaults to ON** when unset — only an explicit `false` or `0` disables it. |
| `NEXT_PUBLIC_APP_URL`          | Next app                   | Already required. The QR endpoint's primary allowed origin.                                                        |
| `NEXT_PUBLIC_ROOT_DOMAIN`      | Next app                   | Already used by `middleware.ts`. Also allows hub subdomains of it. Defaults to `marvedge.com`.                     |

`NEXT_PUBLIC_SHARE_QR_ENABLED` deliberately defaults **on**, unlike the AVS and WTM
flags above, which default off. Those change the artefact — with WTM on, a FREE
export gets a watermark burned into the video — so "unset" has to mean "behave
exactly as before". The QR surface is derived, read-only and additive, and leaves
no state behind, so its flag is a kill-switch for pulling the surface during an
incident rather than a rollout gate. With it off, `<ShareQrCode />` renders nothing
and `/api/qr` returns 404. Note the value is inlined into the client bundle at
build time: flipping it needs a rebuild for the client, only a restart for the
server.

## In-Player Scheduling (OVL)

Part of Interactive Video Overlays (issue #302 §2.3). A viewer can book a meeting
from a Calendly or HubSpot Meetings calendar **inside the video canvas**, without
leaving the share page. Configured per demo from the editor's **Overlays** panel;
free on every plan.

Behind `OVERLAYS_ENABLED` + `NEXT_PUBLIC_OVERLAYS_ENABLED`, both default off.

### The allow-list is the feature

This is the only place in the app that puts a third party's document inside our
page, so the host allow-list — `app/lib/overlays/schedulingHosts.ts` — is the
deliverable, not plumbing. `calendly.com` and `meetings.hubspot.com`, plus their
subdomains, **https only**, and it is enforced in three independent places:

1. **On save.** `PUT /api/demos/[id]/overlays` refuses an off-list host with a 400
   that names the allowed ones, so a bad URL never reaches the database.
2. **On render.** `buildSchedulingEmbedUrl()` re-runs the check before producing an
   `iframe` src, so a row that never passed through the save path — hand-edited,
   restored from a backup — still cannot be framed.
3. **In the CSP.** `frame-src` is derived from the same constant (see below).

The matching is by full hostname: exact equality or a **dot-anchored** suffix,
never `includes()` and never a bare `endsWith()`, both of which wave through
`calendly.com.evil.example`. The parser also infers nothing — an input must
already say `https://`, which is what rejects a bare host and a protocol-relative
`//calendly.com/x`. The hostile-input suite is in `schedulingHosts.test.ts`.

The allow-list is deliberately **not owner-editable**. An owner who could add a
host could frame a credential-harvesting page inside a video carrying their own
customer's branding.

### The CSP

`next.config.ts` sets the app's first `Content-Security-Policy`, **scoped to
`/share/:path*` and `/hub/:path*` only**. It is not global: `/video-editor` runs
ffmpeg.wasm and inline workers, and a blanket policy breaks it on first load.

Both path families are listed because of the customer-domain case — a viewer on
`demos.acme.com` requests `/share/<slug>` and `middleware.ts` rewrites it to
`/hub/<domainKey>/share/<slug>`, so matching only one spelling would leave the
branded route unprotected. `/api` matches neither source and is untouched.

Two honest caveats:

- **It is not XSS protection.** `script-src` carries `'unsafe-inline'` because
  Next's App Router inlines its bootstrap and flight-data scripts; removing it
  needs per-request nonces threaded through middleware.
- **`frame-ancestors` is absent.** Customers embed share links in their own pages
  today and there is no allow-list of their domains, so adding a restrictive one
  would silently break existing embeds.

Neither provider needs a `script-src` entry: both are embedded as a **bare iframe
URL**, never their widget script, so the share page still loads zero third-party
JavaScript.

### Prefill and consent

When the PR 3 lead gate captured a name and email **in this page session**, they
are passed to the provider's prefill params — `name`/`email` for Calendly,
`firstName`/`lastName`/`email` for HubSpot.

Only after consent, and only fields the viewer actually typed. A returning viewer
recognised by their `mv_sid` cookie but who has typed nothing today reaches the
widget with an empty form, and that is correct rather than a limitation: consent
was given for _us_ to make contact, and handing those details to a third party is
a fresh disclosure that only this session's own submit authorises. The lead never
leaves the page component's memory — not `localStorage`, not any URL but the
consented prefill.

### `meeting_booked` is best-effort, and HubSpot is the gap

**Calendly works.** The embed posts a documented `calendly.event_scheduled`
message, checked against the embed URL's exact origin, and a `meeting_booked`
`PlayerEvent` is emitted once per mount. Nothing from the message body goes into
the event's `meta` — a Calendly payload carries the invitee's name and email.

**HubSpot is not reliable.** There is no supported success message for the bare
meetings iframe. The code matches an observed shape (`meetingBookSucceeded`),
which HubSpot may change without notice, so **a HubSpot booking may produce no
`meeting_booked` event at all**. Nothing downstream — the PR 7 funnel included —
may read the absence of this event as evidence that no meeting was booked. Closing
this properly needs the HubSpot API rather than a postMessage, which is out of
scope here.

### Environment variables

| Variable                       | Where             | Purpose                                                                                                         |
| :----------------------------- | :---------------- | :-------------------------------------------------------------------------------------------------------------- |
| `OVERLAYS_ENABLED`             | Next app (server) | Master switch: resolves overlay config on the share routes and mounts the overlay API. Set to `true` to enable. |
| `NEXT_PUBLIC_OVERLAYS_ENABLED` | Next app (client) | Renders the player's overlay layer and the "Overlays" sidebar panel. Set to `true` to enable.                   |

The CSP is **not** behind either flag, deliberately. Next evaluates `headers()` at
build time and bakes the result into `routes-manifest.json`, so a flag-gated policy
would really be a build-time gate — and flipping `OVERLAYS_ENABLED` in a deployed
environment without a rebuild would turn the iframe on while leaving the header
that bounds it silently absent. Every directive was checked against what the share
page loads today, so it is a no-op for a flag-off page.

## Overlay Analytics, Lead Inbox and Retention (OVL)

Part of Interactive Video Overlays (issue #302). Three things the person paying
for the feature actually looks at: the conversion funnel, the leads themselves,
and the retention that keeps both sustainable.

### The funnel reads the rollup, never raw events

`PlayerEvent` is append-only and high-volume — a `video_start`, a `gate_shown`, a
`cta_click` and a `video_completed` for a single viewing. The analytics page
never touches it. It reads **`PlayerEventDaily`**, one row per
`(demoId, name, date)`, so the page costs the same on day 1000 as on day 1.

The funnel stages are `video_start -> gate_shown -> lead_submitted -> cta_click
-> video_completed`, shown in aggregate and per demo over a 30-day window.

**Stages are counted independently and are not a strict subset chain.** A demo
with no lead gate records starts and CTA clicks but no gate views; clicking a
branching card navigates the viewer away before the video completes. So a later
stage can exceed an earlier one, conversion is clamped to 0-100%, and a stage
whose predecessor had no events shows a dash rather than a fabricated ratio.

**Days are UTC.** A row's day is the UTC calendar day of its timestamp, never the
server's local day and never the viewer's — dating by the reader's timezone would
mean the same event rolls up to different days for different readers, and a
timezone change would silently rewrite history. The panel says "UTC" on screen.

### Running the rollup

There is **no scheduler in this repo** (locked decision 10 — no queue, no cron
service). The rollup is an endpoint; point whatever the deployment already uses
at it — Vercel Cron, Cloud Scheduler, a GitHub Action, or a shell:

```bash
curl -X POST https://<host>/api/v3/events/rollup      -H "x-marvedge-rollup-secret: $OVERLAYS_ROLLUP_SECRET"      -H "content-type: application/json"      -d '{"date":"2026-09-01"}'
```

- `date` is optional and defaults to **yesterday** (UTC), the last day that is
  certainly complete. Rolling up today is legal and gives a partial count that
  the next run overwrites.
- `{"skipRetention": true}` runs the rollup alone. Use it when backfilling a
  month of days one at a time, so the sweep does not run thirty times.
- The secret travels in a **header, never a query parameter** — query strings
  land in access logs, proxy logs and `Referer` headers, and this secret
  authorises row deletion. It is compared with `timingSafeEqual`.
- With `OVERLAYS_ROLLUP_SECRET` unset the endpoint answers **503, not 200**: a
  maintenance route that deletes rows fails shut when nobody has configured who
  may call it.
- **Idempotent.** Every write is an upsert that _sets_ the count rather than
  incrementing it, so a retried cron or two overlapping schedulers land exactly
  the same numbers. Re-running a day after a bug fix is safe.

### Retention

Both windows run from the same endpoint, **after** the rollup for that date has
committed. The ordering is load-bearing: `PlayerEventDaily` is the only durable
record of a funnel step, so deleting a raw event that has not been rolled up yet
does not lose a row, it loses a _number_, permanently and with nothing to report
it. The windows do not currently overlap — one edit to the env var is all it
would take, which is exactly why the order is enforced in code rather than
assumed.

| Variable                        | Default       | Deletes                                                |
| :------------------------------ | :------------ | :----------------------------------------------------- |
| `OVERLAYS_EVENT_RETENTION_DAYS` | `90`          | Raw `PlayerEvent` rows. The rollup they fed is kept.   |
| `OVERLAYS_LEAD_RETENTION_DAYS`  | `730` (24 mo) | `Lead` rows, and their `LeadDelivery` rows by cascade. |

A non-numeric or non-positive value falls back to the default rather than
resolving to `0`, which would delete everything older than this morning.

### Lead inbox

`/leads` (behind `NEXT_PUBLIC_OVERLAYS_ENABLED` in the sidebar,
`OVERLAYS_ENABLED` on the page) lists leads for the signed-in user's demos with
their per-connection CRM delivery status, paginated and filterable by demo.

- **CSV export** streams from `/api/leads/export` rather than buffering the
  table, so an export of a successful customer's leads does not become a
  timeout. Cells are RFC 4180 quoted _and_ formula-neutralised — a value starting
  `=`, `+`, `-`, `@`, TAB or CR gets a leading apostrophe, so a name field
  containing `=HYPERLINK(...)` is text in the spreadsheet rather than a live
  exfiltration link. A UTF-8 BOM is emitted so Excel does not mangle non-ASCII
  names.
- **Per-lead delete** for subject-access requests. It is a real delete, not a
  soft one, and takes the `LeadDelivery` rows with it. It cannot reach a CRM the
  lead was already forwarded to, and the UI says so.
- Lead fields are returned to their owner and **never logged**, including from
  inside the export stream.

### Account deletion

`app/api/user/delete/route.ts` deletes sessions and accounts by hand and relies
on cascade for the rest. That chain was **broken**: Prisma defaults a required
relation with no `onDelete` to `Restrict`, so `Demo.userId`,
`ExportedVideo.userId`, `VideoJob.userId`, `Review.userId` and `CtaClick.demoId`
were all `ON DELETE RESTRICT`. `prisma.user.delete()` raised a foreign-key
violation for any user who owned a demo, the route returned a 500, and nothing
was deleted — including the leads.

Migration `20260902000000_cascade_delete_chain` repairs it, and
`app/lib/overlays/cascade.test.ts` parses the real `prisma/schema.prisma` and
fails if any edge regresses.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
