# Marvedge Cloud Run Worker

## Required env vars

- `RAW_BUCKET` - GCS bucket with raw chunk files (`.webm`)
- `PROCESSED_BUCKET` - GCS bucket for rendered output (`.mp4`)

## Optional env vars

- `PORT` (default: `8080`)
- `RAW_PREFIX` (default: empty)
- `PROCESSED_PREFIX` (default: empty)
- `RECIPES_COLLECTION` (default: `recipes`)
- `CHUNKS_COLLECTION` (default: `chunks`)
- `CHUNK_DURATION_SECS` (default: `10`)

## HTTP API

- `GET /healthz`
- `POST /process`

Request body:

```json
{
  "chunkId": "job123_chunk_000",
  "recipeId": "recipe_abc",
  "rawObject": "raw/job123_chunk_000.webm",
  "outputObject": "processed/job123_chunk_000.mp4"
}
```

`rawObject` and `outputObject` are optional. If omitted:

- raw object: `${RAW_PREFIX}${chunkId}.webm`
- output object: `${PROCESSED_PREFIX}${chunkId}.mp4`

## HLS packaging (`POST /package-hls`)

Encodes one source into an adaptive-bitrate ladder (1080p / 720p / 480p, never
upscaling above the source) with **aligned keyframes across renditions**, writes
fMP4 segments plus a master playlist to **Cloudflare R2** under `hls/<demoId>/`,
and returns the `r2://` URI of the master playlist.

Idempotent by demo id + source hash: a run records a `manifest.json` beside the
renditions, and a later run whose source hashes to the same value skips the
encode entirely.

Request body:

```json
{
  "demoId": "demo_abc",
  "videoUrl": "https://storage.googleapis.com/processed/export.mp4",
  "sourceHash": "<the hash recorded by the previous run, optional>",
  "force": false
}
```

`sourceHash` is an optimisation, not a requirement: supplying it lets an
unchanged source be detected with one small GET and no download at all. `force`
repackages regardless.

Response:

```json
{
  "ok": true,
  "result": {
    "recipeId": "package-hls",
    "playlistUri": "r2://processed/hls/demo_abc/master.m3u8",
    "sourceHash": "…",
    "renditions": [{ "height": 1080, "bitrateKbps": 5192 }],
    "duration": 63.5,
    "skipped": false
  }
}
```

### Extra env vars for this endpoint

R2 is separate from the GCS buckets the rest of this worker uses: the playlist
and its segments have to be fetchable from a public CDN edge by the player.

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — required
- `R2_HLS_BUCKET` (or `R2_PROCESSED_BUCKET`) — bucket the renditions go to
- `HLS_PREFIX` (default `hls/`)
- `HLS_SEGMENT_SECONDS` (default `4`) — also the GOP length
- `HLS_FPS` (default `30`) — the constant frame rate every rendition is
  normalised to, which is what makes a frame-counted GOP the same duration in
  each rendition
