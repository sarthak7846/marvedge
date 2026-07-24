import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { QR_SOURCE_VALUE } from "@/app/lib/share/qrTarget";

/**
 * Attribution for a view, currently only "qr" — set when the visitor arrived by
 * scanning a share QR, which encodes the share URL with `?src=qr`.
 *
 * NOT PERSISTED, and that is a deliberate stopping point rather than an
 * oversight. `model View` has no column this could go in (id, demoId,
 * exportedVideoId, timestamp, duration) and there is no events table, so storing
 * it would mean a prisma/schema.prisma change and a migration — out of scope for
 * the QR work, which is otherwise purely additive. It is logged instead, so scan
 * volume is observable in the server logs today, and the client already sends it:
 * whoever adds the column writes one line here and gets history from that day on.
 */
function readViewSource(raw: unknown): typeof QR_SOURCE_VALUE | undefined {
  return raw === QR_SOURCE_VALUE ? QR_SOURCE_VALUE : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const { demoId, exportedVideoId, duration, viewId, source } = await req.json();

    if (viewId && duration !== undefined) {
      // Update existing view with new duration
      const updatedView = await prisma.view.update({
        where: { id: viewId },
        data: { duration },
      });
      return NextResponse.json({ success: true, viewId: updatedView.id });
    }

    if (!demoId && !exportedVideoId) {
      return NextResponse.json({ error: "Missing demoId or exportedVideoId" }, { status: 400 });
    }

    // Check a simple cookie to prevent spamming views on refresh
    const cookieHeader = req.headers.get("cookie") || "";
    const hasViewedKey = `viewed_${exportedVideoId || demoId}`;
    if (cookieHeader.includes(hasViewedKey) && !viewId) {
      // Return success but don't record a new view (simple deduplication)
      // We'll still return a dummy viewId so the client can "update" it, but we won't actually hit the DB
      return NextResponse.json({ success: true, viewId: "deduped" });
    }

    // Create a new view
    const view = await prisma.view.create({
      data: {
        demoId: demoId || null,
        exportedVideoId: exportedVideoId || null,
        duration: 0,
      },
    });

    // Only ever the literal "qr" or nothing — never the caller's string, which
    // would put arbitrary input into a log line.
    if (readViewSource(source)) {
      console.log(
        `[Views] QR scan: view=${view.id} demo=${demoId || "-"} video=${exportedVideoId || "-"}`
      );
    }

    const response = NextResponse.json({ success: true, viewId: view.id });
    // Set a cookie that expires in 1 hour
    response.cookies.set(hasViewedKey, "1", { maxAge: 3600, path: "/" });

    return response;
  } catch (error) {
    console.error("Error handling view:", error);
    return NextResponse.json({ error: "Failed to process view" }, { status: 500 });
  }
}
