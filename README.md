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

| Variable | Where | Purpose |
| :-- | :-- | :-- |
| `AVS_ENABLED` | Next app (server) | Master switch for the AVS server routes. Set to `true` to enable. |
| `NEXT_PUBLIC_AVS_ENABLED` | Next app (client) | Shows the "AI Voice" sidebar panel. Set to `true` to enable. |
| `OPENAI_API_KEY` | Next app (server) | OpenAI script tone rewrite (`/api/avs/script`). |
| `GCP_VIDEO_WORKER_URL` | Next app (server) | Reaches the Cloud Run worker for Aura TTS, subtitles, and alignment. |
| `DEEPGRAM_API_KEY` | **Cloud Run worker only** | Deepgram transcription + Aura TTS. The Next app never holds this key. |

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

| | FREE / anonymous | PRO / ENTERPRISE |
| :-- | :-- | :-- |
| Watermark | Forced Marvedge badge (bottom-right, 55% opacity). Cannot be customized or removed. | Custom PNG, adjustable opacity + corner, or switched off entirely. |
| Camera bubble | Recorded and configurable, but not composited into the export. | Composited into the export. |

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

| Variable | Where | Purpose |
| :-- | :-- | :-- |
| `WTM_ENABLED` | Next app (server) | Master switch for the watermark render/plan logic and the composite route. Set to `true` to enable. |
| `NEXT_PUBLIC_WTM_ENABLED` | Next app (client) | Shows the "Branding" sidebar panel and the preview overlays. Set to `true` to enable. |
| `GCP_VIDEO_WORKER_URL` | Next app (server) | Reaches the Cloud Run worker for the compositing pre-pass. |
| `WTM_COMPOSITE_FPS` | **Cloud Run worker only** | Frame rate both inputs are normalized to. Optional, defaults to `30`. |
| `WTM_COMPOSITE_PREFIX` | **Cloud Run worker only** | GCS prefix for composited sources. Optional, defaults to `wtm-composite/`. |

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


## AI Subtitles (SUB)

SUB generates subtitles from a demo's audio, then lets you correct, re-time,
restyle, translate and export them. It ships behind a feature flag and is a
complete no-op when the flag is off: a demo with no subtitle style, no track and
no language selection exports **byte-identically** to what it produced before the
feature existed.

Unlike AVS, it is **not** plan-gated. Generation, editing, timeline retiming,
styling and `.srt` / `.vtt` / `.txt` export are free on every plan, including FREE
and anonymous. **Translation is the only PRO/ENTERPRISE surface**, gated
server-side in `/api/subtitles/translate` from the user's real plan — it is the
one part that spends money per use at an external vendor. Do not add a plan check
to any other subtitle path.

### The flow

Open a demo in the editor and switch to the **Subtitles** sidebar tab:

1. **Generate** — `/api/subtitles/create` creates a `VideoJob` and returns a
   `jobId` in the same tick, dispatching the work through Next's `after()`. The
   Cloud Run worker's `POST /subtitles` downloads the source, extracts 16 kHz mono
   PCM with ffmpeg, and transcribes it with Deepgram (`nova-2`, or `nova-3` for
   Arabic), clustering word timings into cues. The client polls `/api/jobs/{id}`.
   A blob-URL source is uploaded to GCS first, as `kind: "subtitle-source"`.
2. **Edit** — fix a mis-transcribed word, retime a cue to the centisecond, split a
   long cue at the playhead, merge two short ones, delete or add one. Every
   mutation goes through the pure helpers in `app/lib/subtitles/cues.ts` and ends
   in `normalizeCues()`.
3. **Retime on the timeline** — cues appear as a track on the timeline ruler and
   drag and resize like trim segments. A whole drag lands as one undo step.
4. **Style** — font, size, colour, background box, border, shadow, position and
   animation. The preview overlay and the burned-in export read the same numbers
   from `app/lib/subtitles/style.ts` (see the parity rule below).
5. **Language & translate** — pick the spoken language before generating, switch
   between the demo's per-language tracks, or translate the active one with
   OpenAI. Translation is the gated step.
6. **Export** — download `.srt` / `.vtt` / `.txt`, and/or burn the cues into the
   video. Burn-in is an explicit choice in the export settings, not something that
   happens whenever cues exist.

Cues, the active language and the style all persist to `Demo.editing` through the
normal autosave — there is no save button and no DB migration for them. Generated
and translated tracks are also written to `SubtitleTrack`, one row per
`(demo, language)` holding `cues` as JSON. That is a deliberate, signed-off
deviation from PRD §10's per-segment `SubtitleSegment` table.

### Preview ↔ burn-in parity — the rule that keeps exports honest

**`app/lib/subtitles/style.ts` is the single source of truth for what a subtitle
looks like, and both sides must read it.** The editor preview
(`SubtitleOverlay.tsx`) imports it directly. The renderer cannot —
`cloudrun-worker/` is a standalone package with its own `package.json` and nothing
in it can import from `app/` — so the CSS→ASS mapping exists twice: a TypeScript
original and a JavaScript port in `cloudrun-worker/render.js`.

Two lookalike implementations is exactly the failure this feature was built to
fix. Before it, `SubtitleOverlay.tsx` hardcoded a fixed `16px` while
`writeAssSubtitles()` used a height-proportional `clamp(20, h*0.05, 58)` — they had
already silently drifted, so the preview was not showing what the export produced.

`app/lib/subtitles/workerParity.test.ts` is what stops that recurring: it loads the
**real worker file** and asserts the two produce identical output across a matrix
of styles and frame sizes. **If it fails, the port and the original have drifted —
fix whichever is wrong. Do not relax the assertion.** It is the only mechanical
reason to believe the preview matches the render. The mapping has real traps: ASS
colours are `&H00BBGGRR` (reversed byte order) with *inverted* alpha, and font size
must be resolution-independent (% of frame height), because "24 px" means one thing
on a 640 px preview and another on a 1920 px export.

### The sorted, non-overlapping cue invariant

`remapSubtitleCuesToTrimmedTimeline()` in `cloudrun-worker/render.js` — which
re-times cues across trim segments and slices them per 10 s export chunk —
**assumes its input is sorted and non-overlapping**, and two overlapping ASS
`Dialogue` lines render *stacked on top of each other*, not one after the other.

That assumption used to hold by luck, because the worker was the only producer of
cues and its clustering never overlaps. Once a user can drag a cue's edge over its
neighbour, an overlap is one gesture away (PRD §13 lists it explicitly).

`normalizeCues()` is the single place the invariant is established: it drops junk,
clamps to the video's length, enforces a minimum duration, sorts, and resolves
every overlap — truncating the earlier cue, pushing the later one when truncation
would erase it, and dropping only as a last resort. Every store mutation ends in
it, and `/api/subtitles/export` re-runs it server-side — never trust the client's
ordering. The other helpers in `cues.ts` are deliberately dumb array operations
that do **not** normalize; composing them and normalizing once at the end is what
keeps an undo stack reasonable.

`app/lib/subtitles/burnInInvariant.test.ts` drives the real worker functions end to
end (chunk slice → trim remap → ASS serialization) on overlapping-by-construction
cue sets and asserts the `Dialogue` lines come out ordered and non-overlapping at
the centisecond resolution ASS actually stores.

### Which worker is live

**`cloudrun-worker/` is the deployed worker.** It is what `GCP_VIDEO_WORKER_URL`
points at, it is the only one with a `Dockerfile`, and its `package.json` declares
`main: server.js` with a Cloud Run `start` script.

`video-worker/index.ts` is a near-identical TypeScript twin with its **own** copies
of `writeAssSubtitles` / `transcribeWithDeepgram` /
`remapSubtitleCuesToTrimmedTimeline`. It is a BullMQ/Redis-era leftover: it has no
`Dockerfile`, nothing dispatches to it, and it was last touched by an unrelated
dependency bump. **Do not edit it.** A change to the wrong copy is a silent no-op
that passes every test.

### Generation performance

PRD §7 targets **under 60 s for a 10-minute video** — a ratio of 0.1 s of wall
clock per second of video.

> ⚠️ **This has not been measured yet.** It needs a real 10-minute video pushed
> through a deployed worker, and no `GCP_VIDEO_WORKER_URL` or `DEEPGRAM_API_KEY` is
> configured in this checkout. **The target above is the PRD's requirement, not a
> measurement — do not quote it as one.**

The worker logs everything needed to close this out. Run a 10-minute video through
generation and read one line from the Cloud Run logs:

```
[subtitles] Timing download_ms=… extract_ms=… deepgram_ms=… total_ms=… cues=… duration_s=… source_bytes=… ratio=…
```

`ratio` is the number to compare against the target: seconds of wall clock per
second of video, so **`ratio` < 0.1 meets PRD §7**. `duration_s` is derived exactly
from the extracted WAV (16 kHz mono PCM s16le, so bytes ÷ 32000 is the duration).
The three phase timings say where the time goes if it misses: `download_ms` scales
with file size and GCS locality, `extract_ms` is ffmpeg and scales with duration
and codec, and `deepgram_ms` is one upload-and-wait round trip to the vendor.
**Record the actual numbers here, and if it misses, say by how much and which phase
dominates.**

### Edge cases and limits

| Case | Behaviour |
| :-- | :-- |
| No speech in the video | The job succeeds with zero cues, and the editor says **"No speech detected in this video"** rather than "Subtitles ready". |
| No audio track at all | Distinguished from a corrupted file: *"This video has no audio track, so there is nothing to transcribe."* |
| Corrupted / incomplete upload | The ffmpeg failure is reduced to its last meaningful stderr lines and surfaced as *"This video could not be read — it may be corrupted or the upload may be incomplete."* Never a raw ffmpeg banner dump, never a bare 500. |
| Cancel mid-job | See below — the work does not stop, the result is discarded. |
| Video longer than 2 hours | Refused with the actual length named, client-side and again in the route. |
| Upload not MP4/MOV/AVI/MKV | Refused at the file input **and** in `/api/gcs/upload` with a 400 naming the extension. |
| Upload over 2 GB | Same, with the actual size named. |
| Unsupported language code | The routes reject it with a 400 rather than silently falling back to auto-detect. An **absent** code still means auto-detect. |
| Overlapping cues after editing | Resolved by `normalizeCues()`; see the invariant above. |
| Speaker diarization | **Explicitly not supported** (PRD §15). Cues carry no speaker labels and there is no "who said this" axis anywhere in the data model. Deepgram can diarize; the feature deliberately does not ask it to. |

**Cancelling does not stop the work.** `POST /api/subtitles/cancel` marks the
`VideoJob` `CANCELLED` and the client stops polling immediately, so the editor is
usable again at once. But `/subtitles` is one long opaque HTTP call to Cloud Run
with no cancellation channel: **the worker runs to completion and the Deepgram
minutes are spent either way.** What cancelling buys is that the *result is
discarded* — the dispatcher re-reads the job status before writing anything, so
cues from a cancelled run never land on the demo. The UI copy says exactly this; do
not "improve" it into a promise the mechanism cannot keep.

Uploads are validated in both halves, because they have to be: the browser check is
a courtesy (`accept` is trivially bypassed by drag-and-drop), and `/api/gcs/upload`
mints a signed URL that writes straight into the bucket, so the server check is the
control. Both read the same constants from `app/lib/subtitles/limits.ts`. Note that
**`.webm` is accepted alongside the PRD's four containers** — Marvedge is
recording-first and `MediaRecorder` produces webm, so enforcing the PRD's list
literally would reject the product's primary path.

### If subtitles look wrong in the export

1. **Two lines stacked on top of each other.** The cue list reaching the worker was
   overlapping. Something bypassed `normalizeCues()` — check the mutation path, not
   the renderer. `npm test` runs `burnInInvariant.test.ts`, which covers this.
2. **The style does not match the preview.** The ASS port in
   `cloudrun-worker/render.js` has drifted from `app/lib/subtitles/style.ts`. Run
   `npm test`; `workerParity.test.ts` names the exact field.
3. **Text is the wrong size on a different aspect ratio.** Size is stored as a % of
   frame height on purpose. A px value that leaked into the persisted style will
   look right at one resolution and wrong at every other.
4. **Subtitles drift out of sync after a trim.** `remapSubtitleCuesToTrimmedTimeline`
   re-times cues across keep-segments. Check the recipe's `subtitles` are in
   **source** time, not already-trimmed time.
5. **Subtitles are missing entirely from the export.** Burn-in is an explicit toggle
   in the export settings — having cues is not sufficient. Also check the export
   recipe actually carries `subtitles`.
6. **Arabic renders as disconnected, left-to-right letterforms.** Expected, and why
   `RTL_RENDERING_VERIFIED` in `languages.ts` is `false` and Arabic appears in no
   picker. libass only reorders and shapes bidirectional text when it was built with
   FriBidi and HarfBuzz; the container's ffmpeg build has not been inspected. Verify
   a real 1080p export before flipping that flag.
7. **You edited the worker and nothing changed.** You probably edited
   `video-worker/`. See "Which worker is live" above.

### Environment variables

| Variable | Where | Purpose |
| :-- | :-- | :-- |
| `NEXT_PUBLIC_SUBTITLE_EDITOR_ENABLED` | Next app (client) | Shows the "Subtitles" sidebar panel, and through it the timeline track and style controls. Set to `true` to enable. |
| `SUBTITLE_TRANSLATE_ENABLED` | Next app (server) | Gates the AI translation route. Server-only — never expose it with a `NEXT_PUBLIC_` prefix. |
| `OPENAI_API_KEY` | Next app (server) | Already required by AVS. Reused for translation — no new vendor and no new key. |
| `GCP_VIDEO_WORKER_URL` | Next app (server) | Already required. Reaches the Cloud Run worker for transcription. |
| `DEEPGRAM_API_KEY` | **Cloud Run worker only** | Already required by AVS. Speech-to-text. The Next app never holds this key. |

**Both SUB flags default OFF**, like AVS and WTM and unlike the QR kill-switch.
That is deliberate: the editor panel rewrites cues that get burned into an export
and the translate route spends money, so "unset" has to mean "behave exactly as
today". `SUBTITLE_TRANSLATE_ENABLED` is the *feature* gate, not the paywall — the
PRO/ENTERPRISE check is a separate server-side plan lookup. `NEXT_PUBLIC_…` is
inlined at build time: flipping it needs a rebuild for the client, only a restart
for the server. SUB needs **no new package and no new vendor**. See `.env.example`
for the full list.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
