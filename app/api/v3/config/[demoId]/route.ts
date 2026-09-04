// GET /api/v3/config/[demoId] — public read of a demo's sanitised overlay config.
//
// Nothing in PR 1 consumes this. It exists so PR 2's player has a stable
// contract to fetch against and a future `/embed/...` route has an entry point
// that does not require a session. The share page itself is server-rendered and
// reads the config directly, so this is the cross-origin path, not the hot path.
//
// PUBLIC MEANS PUBLIC: config is returned only for demos with `isPublic` set,
// and only after sanitizeOverlayConfig() has rebuilt it field by field — a
// hand-edited or stale row cannot smuggle arbitrary JSON to a browser through
// here. There is deliberately no session read and no cookie written: this
// response is CDN-cacheable, and a Set-Cookie on a cached response would hand
// one viewer's mv_sid to everybody who hit the same edge node.

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { overlayConfigFromRow } from "@/app/lib/overlays/config";
import { isOverlaysEnabled } from "@/app/lib/overlays/flags";

export const runtime = "nodejs";

/**
 * Short enough that an owner toggling an overlay sees it take effect while they
 * are still looking at the page, long enough to absorb a burst on a popular demo.
 */
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

/** One 404 for every kind of miss, so the endpoint is uninformative to probing. */
function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ demoId: string }> }) {
  if (!isOverlaysEnabled()) {
    return notFound();
  }

  const { demoId } = await params;
  if (!demoId) {
    return notFound();
  }

  const demo = await prisma.demo.findUnique({
    where: { id: demoId },
    select: { id: true, isPublic: true, overlayConfig: true },
  });

  // Not found and not public collapse into the same answer: whether a private
  // demo exists is not something an unauthenticated caller gets to learn.
  if (!demo || !demo.isPublic) {
    return notFound();
  }

  const config = overlayConfigFromRow(demo.overlayConfig);

  return NextResponse.json(
    { success: true, config },
    { headers: { "Cache-Control": CACHE_CONTROL } }
  );
}
