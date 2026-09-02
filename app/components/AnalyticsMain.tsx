"use client";

import React, { useEffect, useState } from "react";
import AnalyticsStatCards from "./analytics/AnalyticsStatCards";
import ViewsOverTimePanel from "./analytics/ViewsOverTimePanel";
import TopDemosPanel from "./analytics/TopDemosPanel";
import OverlayFunnelPanel, { type OverlayFunnelPanelProps } from "./analytics/OverlayFunnelPanel";

type AnalyticsMainProps = {
  totalViews?: number;
  avgDuration?: string;
  completionRate?: string;
  activeShares?: number;
  topDemos?: { title: string; views: number; ctaClicks: number; hasCta: boolean }[];
  viewsOverTime?: { date: string; views: number }[];
  totalCtaClicks?: number;
  uniqueCtaClicks?: number;
  ctaClickRate?: string;
  topCtas?: { label: string; clicks: number }[];
  /** Null or absent when OVERLAYS_ENABLED is off. */
  overlayFunnel?: OverlayFunnelPanelProps | null;
};

const AnalyticsMain = ({
  totalViews = 0,
  avgDuration = "0m 0s",
  completionRate = "0%",
  topDemos = [],
  viewsOverTime = [],
  ctaClickRate = "0%",
  overlayFunnel = null,
}: AnalyticsMainProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div
      className="analytics-body flex h-full min-h-0 flex-col bg-[#F3F1FE] p-4 dark:bg-transparent md:p-6"
      style={{ fontFamily: "var(--font-raleway)" }}
    >
      <p className="mb-4 shrink-0 text-base font-normal text-[rgba(0,0,0,0.43)] dark:text-gray-400 md:text-lg">
        Track performance and engagement across all your demos.
      </p>

      <AnalyticsStatCards
        totalViews={totalViews}
        completionRate={completionRate}
        avgDuration={avgDuration}
        ctaClickRate={ctaClickRate}
        isVisible={isVisible}
      />

      {/* `flex-1` makes the two panels fill a clipped viewport. With the funnel
          below them that would squeeze both to nothing, so the grid falls back
          to its own min-height and the page scrolls. Unchanged when overlays
          are off. */}
      <div
        className={
          overlayFunnel
            ? "grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-2"
            : "grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2"
        }
      >
        <ViewsOverTimePanel viewsOverTime={viewsOverTime} />
        <TopDemosPanel topDemos={topDemos} />
      </div>

      {overlayFunnel ? (
        <OverlayFunnelPanel
          overall={overlayFunnel.overall}
          perDemo={overlayFunnel.perDemo}
          windowDays={overlayFunnel.windowDays}
        />
      ) : null}
    </div>
  );
};

export default AnalyticsMain;
