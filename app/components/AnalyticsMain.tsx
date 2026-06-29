"use client";

import React, { useEffect, useState } from "react";
import AnalyticsStatCards from "./analytics/AnalyticsStatCards";
import ViewsOverTimePanel from "./analytics/ViewsOverTimePanel";
import TopDemosPanel from "./analytics/TopDemosPanel";
import TopCtaPanel from "./analytics/TopCtaPanel";

export const metadata = {
  title: "Settings",
  icon: "/icons/settings.svg",
};

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
  activeShares = 0,
  topDemos = [],
  viewsOverTime = [],
  totalCtaClicks = 0,
  uniqueCtaClicks = 0,
  ctaClickRate = "0%",
  topCtas = [],
}: AnalyticsMainProps) => {
  const topCta = topCtas[0] ?? null;
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleCardHover = (cardId: string) => {
    setHoveredCard(cardId);
  };

  const handleCardLeave = () => {
    setHoveredCard(null);
  };

  return (
    <div className="analytics-body p-4 md:p-8 bg-[#F1ECFF] dark:bg-transparent min-h-screen">
      <h2 className="intro text-base md:text-lg font-light text-gray-400 mb-6">
        Track performance and engagement across all your demos.
      </h2>

      <AnalyticsStatCards
        totalViews={totalViews}
        avgDuration={avgDuration}
        completionRate={completionRate}
        activeShares={activeShares}
        totalCtaClicks={totalCtaClicks}
        uniqueCtaClicks={uniqueCtaClicks}
        ctaClickRate={ctaClickRate}
        topCta={topCta}
        isVisible={isVisible}
        hoveredCard={hoveredCard}
        onHover={handleCardHover}
        onLeave={handleCardLeave}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <ViewsOverTimePanel viewsOverTime={viewsOverTime} />
        </div>
        <TopDemosPanel topDemos={topDemos} />
        <TopCtaPanel topCtas={topCtas} />
      </div>
    </div>
  );
};

export default AnalyticsMain;
