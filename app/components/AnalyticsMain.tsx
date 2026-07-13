"use client";

import React, { useEffect, useState } from "react";
import AnalyticsStatCards from "./analytics/AnalyticsStatCards";
import ViewsOverTimePanel from "./analytics/ViewsOverTimePanel";
import TopDemosPanel from "./analytics/TopDemosPanel";

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
};

const AnalyticsMain = ({
  totalViews = 0,
  avgDuration = "0m 0s",
  completionRate = "0%",
  topDemos = [],
  viewsOverTime = [],
  ctaClickRate = "0%",
}: AnalyticsMainProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div
      className="analytics-body min-h-screen bg-[#F3F1FE] p-4 dark:bg-transparent md:p-8"
      style={{ fontFamily: "var(--font-raleway)" }}
    >
      <p className="mb-6 text-lg font-normal text-[rgba(0,0,0,0.43)] dark:text-gray-400 md:mb-8 md:text-2xl">
        Track performance and engagement across all your demos.
      </p>

      <AnalyticsStatCards
        totalViews={totalViews}
        completionRate={completionRate}
        avgDuration={avgDuration}
        ctaClickRate={ctaClickRate}
        isVisible={isVisible}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ViewsOverTimePanel viewsOverTime={viewsOverTime} />
        <TopDemosPanel topDemos={topDemos} />
      </div>
    </div>
  );
};

export default AnalyticsMain;
