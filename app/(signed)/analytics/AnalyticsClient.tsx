"use client";
import AnalyticsMain from "@/app/components/AnalyticsMain";

type AnalyticsClientProps = {
  totalViews: number;
  avgDuration: string;
  completionRate: string;
  activeShares: number;
  topDemos: { title: string; views: number; ctaClicks: number; hasCta: boolean }[];
  viewsOverTime: { date: string; views: number }[];
  totalCtaClicks: number;
  uniqueCtaClicks: number;
  ctaClickRate: string;
  topCtas: { label: string; clicks: number }[];
};

const AnalyticsPage = (props: AnalyticsClientProps) => {
  return (
    <div className="analytics-page relative flex h-full min-h-0 grow flex-col overflow-y-auto bg-[#F4F1FD] text-[#2D2154] lg:overflow-hidden">
      <AnalyticsMain {...props} />
    </div>
  );
};

export default AnalyticsPage;
