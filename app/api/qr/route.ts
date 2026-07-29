// GET /api/qr?url=...&size=... -> image/svg+xml
//
// A cacheable server-rendered QR for a share link, for the places a React
// component cannot reach: an <img> in an email, a slide, a PDF, an OG image.
//
// Unauthenticated on purpose — it renders a link that is already public, and
// requiring a session would make it useless in exactly those contexts. That is
// also why it must never touch the database: an authenticated-feeling 404 for an
// unknown slug would turn this into an oracle for which share ids exist. The URL
// is validated by SHAPE and ORIGIN only.
//
// There is deliberately no `style` param. `badge` is the one style the product
// surfaces (see MARVEDGE_QR_PRESET in app/lib/qr/presets.ts), and a public
// endpoint should not carry a knob for a style no UI offers.

import { NextRequest, NextResponse } from "next/server";

import { isShareQrEnabled, renderQrSvg, sanitizeQrOptions } from "@/app/lib/qr";
import { toMarvedgeShareUrl, withQrSource } from "@/app/lib/share/qrTarget";

/**
 * The response is a pure function of the query string, so it can be cached
 * forever. A different QR is a different `url`, which is a different cache key.
 */
const IMMUTABLE = "public, max-age=31536000, immutable";

/** One message for every rejection — see toMarvedgeShareUrl on why. */
const REJECTED = "url must be a Marvedge share link";

function badRequest(message: string) {
  return NextResponse.json(
    { error: message },
    // Never cached: whether a URL is allowed depends on the request host, and a
    // cached 400 would outlive a hub domain being configured.
    { status: 400, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  // The kill-switch pulls the whole surface, so this reads as "no such endpoint"
  // rather than "bad input".
  if (!isShareQrEnabled()) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const params = request.nextUrl.searchParams;

  // Origin allowlist. sanitizeQrOptions() below checks scheme and shape but
  // deliberately not the host — that check is this route's, and it goes first.
  const target = toMarvedgeShareUrl(params.get("url"), {
    requestHost: request.headers.get("host"),
  });
  if (!target) {
    return badRequest(REJECTED);
  }

  // `size` is untrusted, so it goes through the engine's sanitizer, which clamps
  // it to the scannable range and drops NaN. Everything else comes from the
  // preset — no colours, no quiet zone, no logo are accepted off the wire.
  const options = sanitizeQrOptions({ url: withQrSource(target), size: params.get("size") });
  if (!options) {
    return badRequest(REJECTED);
  }

  return new NextResponse(renderQrSvg(options), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": IMMUTABLE,
      // The host takes part in the allowlist decision, so it takes part in the
      // cache key. The bytes are identical across hosts; this stops a cached
      // response from being replayed as evidence that some other host allowed it.
      Vary: "Host",
      // Inert by construction — the engine emits shapes and one data: <image>,
      // never a <script> or a remote href. Stated in a header so it stays that
      // way if someone navigates to this URL directly.
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
