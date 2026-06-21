import React from "react";
import Image from "next/image";
import { Play, Eye, CheckCircle, Share2, TrendingUp } from "lucide-react";

interface StatCardConfig {
  bg: string;
  variant: string;
  iconBg: string;
  darkIcon: React.ReactNode;
  lightSrc: string;
  lightAlt: string;
  label: string;
  value: React.ReactNode;
  trend: string;
}

interface DashboardStatCardsProps {
  isDark: boolean;
  totalCount: number;
  totalViews: number;
  activeShares: number;
}

const DashboardStatCards = ({
  isDark,
  totalCount,
  totalViews,
  activeShares,
}: DashboardStatCardsProps) => {
  const cards: StatCardConfig[] = [
    {
      bg: "bg-[#261753]/6",
      variant: "stat-card",
      iconBg: "bg-[#8A76FC]/[0.14]",
      darkIcon: <Play className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />,
      lightSrc: "/mingcute_play-fill.png",
      lightAlt: "Play",
      label: "Total Demos",
      value: totalCount,
      trend: "+12%",
    },
    {
      bg: "bg-[#9BE1F8]/14",
      variant: "stat-card blue",
      iconBg: "bg-[#1565D8]/12",
      darkIcon: <Eye className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />,
      lightSrc: "/icons/dash-eye.svg",
      lightAlt: "Views",
      label: "Total Views",
      value: totalViews,
      trend: "+23%",
    },
    {
      bg: "bg-[#261753]/6",
      variant: "stat-card",
      iconBg: "bg-[#62408F]/13",
      darkIcon: <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />,
      lightSrc: "/icons/dash-grow.svg",
      lightAlt: "Completion Rate",
      label: "Completion Rate",
      value: "0%",
      trend: "+5%",
    },
    {
      bg: "bg-[#DE610E]/10",
      variant: "stat-card red",
      iconBg: "bg-[#DE610E]/15",
      darkIcon: <Share2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />,
      lightSrc: "/icons/share.png",
      lightAlt: "Shares",
      label: "Active shares",
      value: activeShares,
      trend: "+8%",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-6">
      {cards.map((card) => (
        <StatCard key={card.label} card={card} isDark={isDark} />
      ))}
    </div>
  );
};

const StatCard = ({ card, isDark }: { card: StatCardConfig; isDark: boolean }) => (
  <div
    className={`card ${card.bg} dark:bg-[#0a0914] border border-transparent dark:border-[rgba(255,255,255,0.08)] rounded-xl p-3 sm:p-4 md:p-6 flex flex-col items-start shadow-sm dark:shadow-[0_0_35px_rgba(0,0,0,0.35)] min-h-[100px] sm:min-h-[110px] md:min-h-[140px] cursor-pointer transition-all duration-500 ease-out hover:scale-105 sm:hover:scale-110 hover:shadow-lg transform-gpu ${
      isDark ? card.variant : ""
    }`}
  >
    <div className="mb-2">
      <span
        className={`card-icon inline-block ${card.iconBg} dark:bg-[rgba(255,255,255,0.06)] p-1.5 sm:p-2 rounded-lg ${
          isDark ? "stat-icon" : ""
        }`}
      >
        {isDark ? (
          card.darkIcon
        ) : (
          <Image
            src={card.lightSrc}
            alt={card.lightAlt}
            width={18}
            height={18}
            className="sm:w-6 sm:h-6 md:w-7 md:h-7"
          />
        )}
      </span>
    </div>
    <h3 className="stat-label text-xs sm:text-sm md:text-lg font-medium text-black dark:text-[rgba(255,255,255,0.9)]">
      {card.label}
    </h3>
    <div className="stat-value text-xl sm:text-2xl md:text-3xl font-bold text-[#261753]/72 dark:text-white">
      {card.value}
    </div>
    <div className="trend text-xs text-green-600 font-semibold mt-1 flex items-center">
      {isDark && <TrendingUp size={14} className="mr-1" />}
      <strong>{card.trend}</strong>&nbsp;
      <span className="text-gray-500 dark:text-[rgba(255,255,255,0.5)] font-normal text-xs">
        vs last month
      </span>
    </div>
  </div>
);

export default DashboardStatCards;
