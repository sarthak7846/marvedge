// Owner-facing HLS status and the manual "Generate HLS" action.
//
// OWNER-FACING, SO NOT /api/v3. The v3 namespace is for the public,
// unauthenticated, viewer-facing endpoints (locked decision 2); config and
// actions an owner takes about their own demo stay here beside
// /api/demos/[id]/ctas, and follow that route's shape exactly — resolveOwnedDemo()
// first, and a demo that does not exist and a demo somebody else owns collapse
// into the same 404 rather than telling an attacker which it was.
//
// WHAT THIS IS FOR: every demo exported before this feature landed has no
// renditions, and the export-completion trigger only fires on the next export.
// Without a manual action the only way to package an existing demo would be to
// re-export it, which re-encodes the whole video to produce a file identical to
// the one already there.

import { after, NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { packageDemoHls } from "@/app/lib/hls/package";
import { isHlsEnabled } from "@/app/lib/overlays/flags";

// The worker call in packageDemoHls() runs inside after(), so the invocation is
// still live once the response has gone out. Same reasoning as the export route.
export const maxDuration = 300;
export const runtime = "nodejs";

async function resolveOwnedDemo(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const demo = await prisma.demo.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    select: { id: true },
  });

  if (!demo) {
    return {
      error: NextResponse.json({ error: "Demo not found" }, { status: 404 }),
    };
  }

  return { demo };
}

/**
 * Current packaging state for a demo, so the editor can show "Adaptive
 * streaming: on / not generated" without guessing.
 *
 * The playlist URI is deliberately NOT returned: an owner has no use for the
 * `r2://` form, and the share page resolves it to https itself. `hasRenditions`
 * plus a timestamp is the whole answer.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await resolveOwnedDemo(id);
  if ("error" in owned) {
    return owned.error;
  }

  const exported = await prisma.exportedVideo.findUnique({
    where: { demoId: id },
    select: { exportedUrl: true, hlsPlaylistUrl: true, hlsUpdatedAt: true },
  });

  return NextResponse.json({
    success: true,
    enabled: isHlsEnabled(),
    // No export means nothing to package: the button should be disabled, not
    // clicked and then silently do nothing.
    packageable: Boolean(exported?.exportedUrl),
    hasRenditions: Boolean(exported?.hlsPlaylistUrl),
    updatedAt: exported?.hlsUpdatedAt ?? null,
  });
}

/**
 * Kick off packaging for a demo that already has an export.
 *
 * 202, not 200, and the work runs in after(): a three-rung ladder takes minutes
 * and the owner is not going to hold a request open for it. The response says
 * "started", and GET above is how the editor learns it finished.
 *
 * `force: true` because this endpoint only exists to be pressed deliberately.
 * The whole point of clicking it when renditions already exist is to redo them
 * — an owner whose packaging run half-failed has no other way to make the
 * worker ignore its own idempotency marker.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await resolveOwnedDemo(id);
  if ("error" in owned) {
    return owned.error;
  }

  // 503 rather than 404: the demo is real and the caller is allowed to ask, the
  // deployment simply has not turned this on. A 404 here would send an owner
  // looking for a missing demo.
  if (!isHlsEnabled()) {
    return NextResponse.json({ error: "HLS packaging is not enabled" }, { status: 503 });
  }

  const exported = await prisma.exportedVideo.findUnique({
    where: { demoId: id },
    select: { exportedUrl: true },
  });
  if (!exported?.exportedUrl) {
    return NextResponse.json(
      { error: "This demo has no export to package. Export it first." },
      { status: 409 }
    );
  }

  after(() => packageDemoHls(id, { force: true }));

  return NextResponse.json({ success: true, status: "started" }, { status: 202 });
}
