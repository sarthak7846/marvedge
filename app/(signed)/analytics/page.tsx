import { getPageMetadata } from "@/app/lib/metadata";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import AnalyticsClient from "./AnalyticsClient";

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

  return (
    <AnalyticsClient
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
