-- OVL PR 8 — HLS renditions on ExportedVideo.
--
-- Hand-written and applied with `migrate deploy`, for the reason recorded in
-- Overlays-Implementation-Plan.md §0: the live database carries a SubtitleTrack
-- table this schema does not declare, which `migrate dev` would read as drift.
--
-- WHY COLUMNS AND NOT ExportedVideo.settings
-- ------------------------------------------
-- `settings` is a client-supplied blob that POST /api/exported-videos writes
-- wholesale on both branches of its upsert (`settings: settings ?? null`). A
-- playlist URL parked in it would be silently erased by the next export save —
-- the same trap that kept overlay config out of Demo.editing (locked decision
-- 3). These values are also read by an unauthenticated share page on every
-- view, where a column can be selected and a JSON path cannot.
--
-- All three are NULLABLE with no default and no backfill. Every existing row
-- means "no renditions", which is the fallback path the player already takes
-- for every demo, so this migration changes no behaviour on its own.
--
-- hlsPlaylistUrl  r2://<bucket>/hls/<demoId>/master.m3u8 (app/lib/r2.ts's scheme)
-- hlsSourceHash   sha256 of the source the renditions were produced from; what
--                 makes re-running the packager on an unchanged source a no-op
-- hlsUpdatedAt    when the renditions last landed, for the owner-facing status

ALTER TABLE "ExportedVideo" ADD COLUMN IF NOT EXISTS "hlsPlaylistUrl" TEXT;
ALTER TABLE "ExportedVideo" ADD COLUMN IF NOT EXISTS "hlsSourceHash" TEXT;
ALTER TABLE "ExportedVideo" ADD COLUMN IF NOT EXISTS "hlsUpdatedAt" TIMESTAMP(3);
