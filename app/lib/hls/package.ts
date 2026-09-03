// Packaging one demo's HLS renditions, and recording where they landed.
//
// SERVER ONLY. It reads env through app/lib/overlays/flags.ts, talks to Prisma
// and calls the Cloud Run worker, so it deliberately does NOT live under
// app/lib/overlays/ — that directory is isomorphic and pure and one node-only
// import in it would break the editor build. The pure half of this feature
// (object keys, playlist validation, which URL the player gets) is in
// app/lib/overlays/hls.ts and is imported from here.
//
// TWO CALLERS, ONE FUNCTION: the export-completion trigger in
// POST /api/exported-videos and the manual "Generate HLS" action in
// POST /api/demos/[id]/hls. Both run it inside Next's after(), the same shape as
// dispatchVideoJob() in app/api/jobs/create/route.ts — nobody waits on an
// ffmpeg ladder inside a request.
//
// IT NEVER THROWS AT ITS CALLER. Packaging is an enhancement on top of an export
// that has already succeeded, and a failure here must not turn a completed
// export into a failed one. Every path returns a result object and logs a
// literal; the demo keeps playing its progressive MP4, which is what every demo
// does today.

import { prisma } from "@/app/lib/prisma";
import { invokeGcpPackageHls } from "@/app/lib/gcpWorker";
import { isHlsEnabled } from "@/app/lib/overlays/flags";
import { isPlayablePlaylistUri } from "@/app/lib/overlays/hls";
import { toHttpsUrl } from "@/app/lib/r2";

export type PackageHlsOutcome =
  /** Renditions exist and ExportedVideo now points at them. */
  | { status: "packaged"; playlistUri: string; skipped: boolean }
  /** Nothing was attempted: flag off, no export, or nothing to package. */
  | { status: "noop"; reason: string }
  /** The worker or the write failed. The demo still plays its MP4. */
  | { status: "failed"; reason: string };

/**
 * Package a demo's current export into an HLS ladder and store the playlist URI.
 *
 * `force` skips the idempotency short-circuit, for the manual action — an owner
 * who clicks "Generate HLS" after a packaging run went wrong needs a way to make
 * it run again, and "delete the marker object by hand" is not one.
 */
export async function packageDemoHls(
  demoId: string,
  { force = false }: { force?: boolean } = {}
): Promise<PackageHlsOutcome> {
  if (!isHlsEnabled()) {
    return { status: "noop", reason: "flag_off" };
  }

  try {
    const exported = await prisma.exportedVideo.findUnique({
      where: { demoId },
      select: { id: true, exportedUrl: true, hlsSourceHash: true },
    });

    // No export row means no finished render to package. The demo may still
    // have a raw videoUrl, but packaging a raw capture would produce renditions
    // of the un-edited source — a different video from the one the share page
    // plays.
    if (!exported?.exportedUrl) {
      return { status: "noop", reason: "no_export" };
    }

    const result = await invokeGcpPackageHls({
      demoId,
      videoUrl: exported.exportedUrl,
      // Passing the recorded hash lets the worker answer "unchanged" after one
      // small object read instead of downloading the whole export to find out.
      sourceHash: force ? undefined : (exported.hlsSourceHash ?? undefined),
      force,
    });

    // Guard the value on the way IN as well as on the way out. The share page
    // validates what it reads (isPlayablePlaylistUri in the pure lib), but a
    // column that only ever held a valid playlist is a column nobody has to
    // wonder about.
    if (!isPlayablePlaylistUri(result.playlistUri)) {
      console.error(`[ovl-hls] worker returned an unusable playlist URI for demo ${demoId}`);
      return { status: "failed", reason: "bad_playlist_uri" };
    }

    await prisma.exportedVideo.update({
      where: { id: exported.id },
      data: {
        hlsPlaylistUrl: result.playlistUri,
        hlsSourceHash: result.sourceHash || null,
        hlsUpdatedAt: new Date(),
      },
    });

    console.log(
      `[ovl-hls] demo=${demoId} packaged skipped=${result.skipped} ` +
        `rungs=${result.renditions.length}`
    );
    return { status: "packaged", playlistUri: result.playlistUri, skipped: result.skipped };
  } catch (error) {
    // A literal plus the demo id and an error message that came from OUR worker,
    // never from viewer input — this path never sees a lead.
    console.error(
      `[ovl-hls] packaging failed for demo ${demoId}:`,
      error instanceof Error ? error.message : "unknown_error"
    );
    return { status: "failed", reason: "worker_error" };
  }
}

/**
 * The https playlist URL for a demo, or null when there is nothing to play.
 *
 * Resolves the stored `r2://` URI through app/lib/r2.ts, which yields a URL on
 * the public R2 host — the segments the playlist references are fetched from
 * that same host by the player, so the master playlist has to be served from it
 * too. Returns null (rather than throwing) for a missing, disabled or invalid
 * value, so every caller's fallback is the progressive MP4.
 */
export function resolveHlsPlaylistUrl(storedUri: string | null | undefined): string | null {
  if (!isHlsEnabled() || !isPlayablePlaylistUri(storedUri)) {
    return null;
  }
  const url = toHttpsUrl(storedUri);
  // toHttpsUrl passes an r2:// URI through UNCHANGED when R2_PUBLIC_BASE_URL is
  // unset, because there is then no public host to serve it from. Handing that
  // to a <video> would be a guaranteed failure, so treat it as no playlist.
  return isPlayablePlaylistUri(url) && !url.startsWith("r2://") ? url : null;
}
