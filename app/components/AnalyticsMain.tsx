"use client";

import React, { useEffect, useState } from "react";
import AnalyticsStatCards from "./analytics/AnalyticsStatCards";
import ViewsOverTimePanel from "./analytics/ViewsOverTimePanel";
import TopDemosPanel from "./analytics/TopDemosPanel";

export const metadata = {
  title: "Settings",
  icon: "/icons/settings.svg",
};

type AnalyticsMainProps = {
  totalViews?: number;
  avgDuration?: string;
  completionRate?: string;
  activeShares?: number;
  topDemos?: { title: string; views: number }[];
  viewsOverTime?: { date: string; views: number }[];
};

const AnalyticsMain = ({
  totalViews = 0,
  avgDuration = "0m 0s",
  completionRate = "0%",
  activeShares = 0,
  topDemos = [],
  viewsOverTime = [],
}: AnalyticsMainProps) => {
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
        isVisible={isVisible}
        hoveredCard={hoveredCard}
        onHover={handleCardHover}
        onLeave={handleCardLeave}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ViewsOverTimePanel viewsOverTime={viewsOverTime} />
        <TopDemosPanel topDemos={topDemos} />
      </div>
    </div>
  );
};

export default AnalyticsMain;
