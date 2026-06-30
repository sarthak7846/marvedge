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
    <div className="analytics-page flex flex-col grow h-full bg-[#F4F1FD] text-[#2D2154] relative overflow-y-auto">
      <AnalyticsMain {...props} />
    </div>
  );
};

export default AnalyticsPage;
