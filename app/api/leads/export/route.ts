// GET /api/leads/export — the lead inbox as a CSV download.
//
// ============================================================================
// IT STREAMS. IT DOES NOT BUFFER THE TABLE.
// ============================================================================
// The obvious implementation — findMany() the whole table, map to rows, join
// with newlines, return the string — holds every lead the workspace has ever
// captured in memory twice (the Prisma rows and the joined string) and produces
// nothing until the last one is loaded. On a serverless function that is how an
// export of a successful customer's leads becomes a timeout, and a timeout on
// this route means the owner cannot get their data out before deleting it.
//
// So: a ReadableStream, filled by a cursor-paged read. Memory is one page of
// leads, not the table, and the browser starts receiving bytes immediately.
// Cursor-paged rather than skip/take because an offset scan gets quadratically
// slower as the export goes on — the exact wrong shape for a long export.
//
// ============================================================================
// PII: EXPORTED, NEVER LOGGED — INCLUDING FROM INSIDE THE STREAM
// ============================================================================
// This route's entire payload is PII, delivered to its own owner over an
// authenticated session. Nothing here logs a lead field, and that rule is
// hardest to hold exactly here: a throw inside a stream's pull() is reported by
// the runtime with whatever the error carries, so a Prisma error quoting its
// arguments would land in the platform log. The read is therefore wrapped, and
// the stream is closed on failure with a literal logged — a truncated CSV the
// owner can retry, never a name in a log line.
//
// CSV INJECTION is handled in app/lib/overlays/csv.ts, not here: a cell starting
// `=`, `+`, `-` or `@` is neutralised with a leading apostrophe before it
// reaches a spreadsheet. See that file for why, and csv.test.ts for the fixtures.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { leadCsvHeader, leadCsvRow, summarizeDeliveries } from "@/app/lib/overlays/csv";
import { utcDateKey } from "@/app/lib/overlays/rollup";

export const runtime = "nodejs";

// A large export is a long-lived response. Same ceiling as the other long routes
// in this app (app/api/jobs/create/route.ts).
export const maxDuration = 300;

/** Leads fetched per round-trip. The high-water mark for this route's memory. */
const PAGE_SIZE = 500;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const demoId = request.nextUrl.searchParams.get("demoId")?.trim() || null;

  // The same ownership predicate as the inbox. An unowned demoId filters to
  // nothing rather than erroring, so this cannot probe for demo ids either.
  const where = {
    demo: { userId },
    ...(demoId ? { demoId } : {}),
  };

  const encoder = new TextEncoder();
  // Paging is by (createdAt desc, id desc) with an id cursor: `createdAt` alone
  // is not unique — two leads captured in the same millisecond would make the
  // page boundary ambiguous and could drop or duplicate a row across pages.
  let cursor: string | undefined;
  let done = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // UTF-8 BOM. Excel on Windows ignores the charset in Content-Type for a
      // downloaded .csv and falls back to the system codepage, which turns every
      // accented name in the export into mojibake. The BOM is the only thing it
      // reliably honours. Sheets, LibreOffice and every CSV parser worth using
      // skip it.
      controller.enqueue(encoder.encode("\uFEFF"));
      controller.enqueue(encoder.encode(leadCsvHeader()));
    },
    async pull(controller) {
      if (done) {
        controller.close();
        return;
      }

      try {
        const page = await prisma.lead.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: PAGE_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            name: true,
            email: true,
            companySize: true,
            createdAt: true,
            consentAt: true,
            consentText: true,
            referrer: true,
            demoId: true,
            demo: { select: { title: true } },
            deliveries: {
              select: { status: true, connection: { select: { provider: true } } },
            },
          },
        });

        for (const lead of page) {
          controller.enqueue(
            encoder.encode(
              leadCsvRow({
                id: lead.id,
                createdAt: lead.createdAt,
                name: lead.name,
                email: lead.email,
                companySize: lead.companySize,
                demoTitle: lead.demo?.title ?? null,
                demoId: lead.demoId,
                referrer: lead.referrer,
                consentAt: lead.consentAt,
                consentText: lead.consentText,
                deliveryStatus: summarizeDeliveries(
                  lead.deliveries.map((d) => ({
                    provider: d.connection.provider,
                    status: d.status,
                  }))
                ),
              })
            )
          );
        }

        if (page.length < PAGE_SIZE) {
          done = true;
          controller.close();
          return;
        }
        cursor = page[page.length - 1].id;
      } catch (error) {
        // A literal only. NOT controller.error(error) — that would hand the
        // runtime an object whose message may quote the query, and this query
        // selects every lead field there is.
        console.error(
          "[ovl-leads] export failed:",
          error instanceof Error ? error.message : "unknown error"
        );
        done = true;
        controller.close();
      }
    },
  });

  const filename = `marvedge-leads-${utcDateKey(new Date())}.csv`;

  return new NextResponse(stream, {
    headers: {
      // charset=utf-8 is not decoration: without it Excel reads the file in the
      // system codepage and mangles every non-ASCII name in the export.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // This response IS someone's personal data. It must not sit in a shared
      // cache, a CDN, or the browser's disk cache after a sign-out.
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
