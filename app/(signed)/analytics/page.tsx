import { getPageMetadata } from "@/app/lib/metadata";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { isOverlaysEnabled } from "@/app/lib/overlays/flags";
import { deriveDemoFunnels, type DemoEventTotal } from "@/app/lib/overlays/funnel";
import { utcDayStart } from "@/app/lib/overlays/rollup";
import AnalyticsClient from "./AnalyticsClient";

/** How far back the overlay funnel reports. Matches "Views over time" above it. */
const FUNNEL_WINDOW_DAYS = 30;

export const metadata = getPageMetadata("analytics");

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }
  const userId = session.user.id;

  const views = await prisma.view.findMany({
    where: {
      OR: [{ demo: { userId } }, { exportedVideo: { userId } }],
    },
    include: { demo: true, exportedVideo: true },
  });
  const totalViews = views.length;

  let totalDuration = 0;
  views.forEach((v) => {
    totalDuration += v.duration || 0;
  });
  const avgDurationSec = views.length ? Math.round(totalDuration / views.length) : 0;
  const avgDuration = `${Math.floor(avgDurationSec / 60)}m ${avgDurationSec % 60}s`;

  // Generic completion rate based on ~45s average demo length
  const completionRate = views.length
    ? `${Math.min(100, Math.round((avgDurationSec / 45) * 100))}%`
    : "0%";

  const activeSharesAgg = await prisma.exportedVideo.aggregate({
    where: { userId },
    _sum: { shareCount: true },
  });
  const activeShares = activeSharesAgg._sum.shareCount ?? 0;

  const demos = await prisma.demo.findMany({
    where: { userId },
    include: {
      views: true,
      exportedVideo: {
        include: { views: true },
      },
      _count: { select: { ctas: true, ctaClicks: true } },
    },
  });
  const topDemos = demos
    .map((d) => {
      // To avoid double counting, we could use a Set of view IDs
      const allViewIds = new Set([
        ...d.views.map((v) => v.id),
        ...(d.exportedVideo?.views.map((v) => v.id) || []),
      ]);
      return {
        title: d.title,
        views: allViewIds.size,
        ctaClicks: d._count.ctaClicks,
        hasCta: d._count.ctas > 0,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  const viewCountsByDate: Record<string, number> = {};
  views.forEach((v) => {
    const dateStr = v.timestamp.toISOString().split("T")[0];
    viewCountsByDate[dateStr] = (viewCountsByDate[dateStr] || 0) + 1;
  });
  const viewsOverTime = Object.entries(viewCountsByDate)
    .map(([date, count]) => ({ date, views: count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // CTA analytics (clicks for the logged-in user's demos)
  const ctaClickRows = await prisma.ctaClick.findMany({
    where: { demo: { userId } },
    select: { userId: true, sessionId: true },
  });
  const totalCtaClicks = ctaClickRows.length;
  // unique clicks = COUNT(DISTINCT COALESCE(userId, sessionId)); nulls are not counted
  const uniqueCtaClicks = new Set(
    ctaClickRows.map((c) => c.userId ?? c.sessionId).filter((id): id is string => Boolean(id))
  ).size;
  // CTA click rate = unique clicks (per browser) ÷ total views; guard divide-by-zero
  const ctaClickRate = totalViews ? `${Math.round((uniqueCtaClicks / totalViews) * 100)}%` : "0%";

  // top performing CTA(s): group clicks by label, ordered by click count
  const ctaByLabel = await prisma.ctaClick.groupBy({
    by: ["label"],
    where: { demo: { userId } },
    _count: { label: true },
    orderBy: { _count: { label: "desc" } },
    take: 5,
  });
  const topCtas = ctaByLabel.map((g) => ({
    label: g.label,
    clicks: g._count.label,
  }));

  // ==========================================================================
  // OVERLAY FUNNEL (OVL PR 7) — READS THE ROLLUP, NEVER RAW EVENTS
  // ==========================================================================
  // TWO QUERIES, AND NEITHER GROWS WITH EVENT VOLUME. `demos` above is reused
  // for ids and titles, so this section adds exactly one: a groupBy over
  // PlayerEventDaily, which holds one row per (demo, event name, day) and is
  // collapsed to (demo, event name) by the database. A workspace with 10 demos
  // over a 30-day window reads at most 10 x 7 x 30 rows and returns at most
  // 10 x 7 — whether those days held a thousand views or ten million.
  //
  // The equivalent query against PlayerEvent would return a row per event and
  // is the thing locked decision 9 exists to forbid. There is no findMany on
  // PlayerEvent anywhere in this file, and there must not be one.
  //
  // NOTE, and out of scope here by instruction: the `view.findMany` at the top
  // of this file loads every View row for the user with two joins and
  // aggregates in JS. It survives because View is one row per view. It is a
  // known problem, called out in Overlays-Implementation-Plan.md, and it is
  // deliberately NOT touched by this PR.
  //
  // Gated on the server flag: with overlays off there is nothing to report and
  // the page renders exactly as it did before this feature existed.
  let overlayFunnel: {
    overall: ReturnType<typeof deriveDemoFunnels>["overall"];
    perDemo: ReturnType<typeof deriveDemoFunnels>["perDemo"];
    windowDays: number;
  } | null = null;

  if (isOverlaysEnabled()) {
    const since = new Date(utcDayStart(new Date()).getTime() - (FUNNEL_WINDOW_DAYS - 1) * 86400000);

    // PlayerEventDaily has no foreign key to Demo (by design — the rollup must
    // outlive its demo so historical totals do not rewrite themselves), so
    // ownership is enforced with an explicit id list rather than a join. The
    // list is bounded by the user's demo count, not by traffic.
    const demoIds = demos.map((d) => d.id);

    const totals = demoIds.length
      ? await prisma.playerEventDaily.groupBy({
          by: ["demoId", "name"],
          where: { demoId: { in: demoIds }, date: { gte: since } },
          _sum: { count: true },
        })
      : [];

    const rows: DemoEventTotal[] = totals.map((row) => ({
      demoId: row.demoId,
      name: row.name,
      count: row._sum.count ?? 0,
    }));

    const { overall, perDemo } = deriveDemoFunnels(
      rows,
      new Map(demos.map((d) => [d.id, d.title]))
    );
    overlayFunnel = { overall, perDemo, windowDays: FUNNEL_WINDOW_DAYS };
  }

  return (
    <AnalyticsClient
      overlayFunnel={overlayFunnel}
      totalViews={totalViews}
      avgDuration={avgDuration}
      completionRate={completionRate}
      activeShares={activeShares}
      topDemos={topDemos}
      viewsOverTime={viewsOverTime}
      totalCtaClicks={totalCtaClicks}
      uniqueCtaClicks={uniqueCtaClicks}
      ctaClickRate={ctaClickRate}
      topCtas={topCtas}
    />
  );
}
