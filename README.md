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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
