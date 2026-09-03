-- OVL PR 7 — repair the account-deletion cascade chain.
--
-- Hand-written and applied with `migrate deploy`, for the reason recorded in
-- Overlays-Implementation-Plan.md §0: the live database carries a SubtitleTrack
-- table this schema does not declare, which `migrate dev` would read as drift.
--
-- THE BUG THIS FIXES
-- ------------------
-- Prisma defaults a REQUIRED relation with no `onDelete` to `Restrict`. Five
-- foreign keys were therefore ON DELETE RESTRICT in this database:
--
--   Demo.userId          (20250818150238_init)
--   ExportedVideo.userId (20260310163000_add_exported_video)
--   VideoJob.userId      (20260310135638_add_video_job_table)
--   Review.userId        (20260703000000_reconcile_schema_drift)
--   CtaClick.demoId      (20260703000000_reconcile_schema_drift)
--
-- app/api/user/delete/route.ts deletes Session and Account rows by hand and then
-- calls user.delete(), relying on cascade for everything else. Against a user
-- who owned even one Demo that DELETE raised a foreign-key violation, the route
-- returned 500, and nothing was removed.
--
-- With the OVL tables in place that stops being a broken button: a Lead row is a
-- viewer's name, email address, company size and consent record, and it was
-- surviving the deletion of the account it was collected under. The overlay
-- tables all cascade correctly on their own — the chain broke one link above
-- them, at Demo.
--
-- DROP/ADD rather than a bare ALTER, and IF EXISTS on every drop, because this
-- database's constraint state has drifted from its migration history before.
-- This lands the same constraints regardless of what was there.
--
-- NOT CHANGED, deliberately:
--   Account.userId / Session.userId — still RESTRICT. The delete route removes
--     those rows explicitly first, and NextAuth owns both tables.
--   View.demoId / View.exportedVideoId — still SET NULL. A View is an anonymous
--     counter with no PII; orphaning it preserves historical totals.

-- Demo: the missing link. Deleting a User now reaches their demos, and through
-- them VideoOverlayConfig, Lead, LeadDelivery, PlayerEvent, Cta and AudioClip.
ALTER TABLE "Demo" DROP CONSTRAINT IF EXISTS "Demo_userId_fkey";
ALTER TABLE "Demo" ADD CONSTRAINT "Demo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CtaClick: blocked Demo deletion, so it blocked User deletion through Demo.
ALTER TABLE "CtaClick" DROP CONSTRAINT IF EXISTS "CtaClick_demoId_fkey";
ALTER TABLE "CtaClick" ADD CONSTRAINT "CtaClick_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ExportedVideo, VideoJob, Review: each independently blocked User deletion.
ALTER TABLE "ExportedVideo" DROP CONSTRAINT IF EXISTS "ExportedVideo_userId_fkey";
ALTER TABLE "ExportedVideo" ADD CONSTRAINT "ExportedVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoJob" DROP CONSTRAINT IF EXISTS "VideoJob_userId_fkey";
ALTER TABLE "VideoJob" ADD CONSTRAINT "VideoJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_userId_fkey";
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
